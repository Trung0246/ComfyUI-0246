# Built-in
import ast
sys = __import__("sys")
import random
import builtins
import json
import pathlib

# Self Code
from . import utils as utils0246

# 3rd Party
import aiohttp.web

# ComfyUI
from server import PromptServer
import execution
import nodes

# ComfyUI 3rd Party
ext = {}

with utils0246.temp_dir(pathlib.Path(__file__).parent.parent.parent.absolute() / "custom_nodes"):

	work_path = pathlib.Path.cwd()

	sys.path.insert(0, work_path)

	ext.update({
		"was": utils0246.import_module("WAS_Node_Suite", "was-node-suite-comfyui/WAS_Node_Suite.py"),
		"insp": utils0246.import_module("ComfyUI-Inspire-Pack", "ComfyUI-Inspire-Pack/__init__.py"),
	})

	sys.path.remove(work_path)

######################################################################################
######################################## IMPL ########################################
######################################################################################

def pack_loop(_junc_in, name, value):
	_junc_in[("type", name)] = type(value).__name__
	count = _junc_in.path_count(("data", name))
	_junc_in[("data", name, count)] = value
	if count == 0:
		_junc_in[("index", name)] = 0

def find_input_node(nodes, link):
	for node in nodes:
		if node.get("inputs"):
			for input in node["inputs"]:
				if input["link"] == link:
					return node["id"]
	return None

def trace_node(_prompt, _id, _workflow, _shallow = False, _input = False):
	id_stk = []
	if _input:
		for key in _prompt[_id]["inputs"]:
			if isinstance(_prompt[_id]["inputs"][key], list) and key != "_event":
				id_stk.append(_prompt[_id]["inputs"][key][0])
	else:
		id_stk.append(_id)
	
	while len(id_stk) > 0:
		curr_id = id_stk.pop(0)
		if curr_id in BASE_EXECUTOR.outputs:
			del BASE_EXECUTOR.outputs[curr_id]
		for node in _workflow["workflow"]["nodes"]:
			if node["id"] == int(curr_id):
				if node.get("outputs"):
					for output in node["outputs"]:
						if output.get("links"):
							for link in output["links"]:
								linked_node_id = find_input_node(_workflow["workflow"]["nodes"], link)
								if linked_node_id is not None:
									if _shallow:
										if linked_node_id in BASE_EXECUTOR.outputs:
											del BASE_EXECUTOR.outputs[linked_node_id]
									else:
										id_stk.append(str(linked_node_id))

def junction_impl(self, _id, _prompt, _workflow, _junc_in, _offset = None, _in_mode = False, _out_mode = False, _offset_mode = False, **kwargs):
	if isinstance(_prompt, list):
		_prompt = _prompt[0]
	if isinstance(_id, list):
		_id = _id[0]
	if isinstance(_offset, list):
		_offset = _offset[0]
	if isinstance(_workflow, list):
		_workflow = _workflow[0]

	_type = _prompt[_id]["inputs"]["_type"]

	if _junc_in is None:
		_junc_in = utils0246.RevisionDict()
	else:
		_junc_in = utils0246.RevisionDict(_junc_in)

	# _junc_in._id = _id
	# _junc_in.purge(_junc_in.find(lambda item: item.id == _id))

	# Pack all data from _junc_in and kwargs together with a specific format

	if _in_mode:
		flat_iter = utils0246.FlatIter(kwargs)
		for param, (key, value) in utils0246.flat_zip(_type["in"], flat_iter):
			pack_loop(_junc_in, param["type"], value)
	else:
		for param, key in zip(_type["in"], list(kwargs)):
			pack_loop(_junc_in, param["type"], kwargs[key])

	# Parse the offset string

	if hasattr(self, "_prev_offset") and hasattr(self, "_parsed_offset") and _offset is not None:
		if type(_offset) is str:
			_offset = ast.literal_eval(_offset)
		if _offset["data"] != self._prev_offset:
			parsed_offset, err = utils0246.parse_offset(_offset["data"])
			if err:
				raise Exception(err)
			self._prev_offset = _offset["data"]
			self._parsed_offset = parsed_offset

	# Apply the offset to the junction input

	if hasattr(self, "_parsed_offset"):
		if self._parsed_offset is None:
			raise Exception("Offset is not parsed.")
		
		for elem in self._parsed_offset:
			total = _junc_in.path_count(("data", elem[0]))
			if total == 0:
				raise Exception(f"Type \"{elem[0]}\" in offset string does not available in junction.")

			# Check for ops char

			if elem[1][0] == '+':
				_junc_in[("index", elem[0])] += int(elem[1][1:])
			elif elem[1][0] == '-':
				_junc_in[("index", elem[0])] -= int(elem[1][1:])
			else:
				_junc_in[("index", elem[0])] = int(elem[1])
			
			temp = _junc_in[("index", elem[0])]
			if temp >= total:
				raise Exception(f"Offset \"{elem[1]}\" (total: \"{temp}\") is too large (count: \"{total}\").")
			elif temp < 0:
				raise Exception(f"Offset \"{elem[1]}\" (total: \"{temp}\") is too small (count: \"{total}\").")

	res = []
	track = {}

	if _out_mode:
		done_type = {}
		for elem in _type["out"]:
			if elem["full_name"] in utils0246.BLACKLIST:
				continue

			if elem["type"] in done_type:
				# Rotate the list from [11, 22, 33] to [22, 33, 11]
				res.append(done_type[elem["type"]][1:] + done_type[elem["type"]][:1])
				continue
			
			total = _junc_in.path_count(("data", elem["type"]))
			if total == 0:
				raise Exception(f"Type \"{elem['type']}\" of output \"{elem['full_name']}\" does not available in junction.")
			
			offset = _junc_in[("index", elem["type"])]

			if offset >= total:
				raise Exception(f"Too much type \"{elem['type']}\" being taken or offset \"{offset}\" is too large (count: \"{total}\").")
			
			temp = []
			res.append(temp)

			for i in range(offset, total):
				temp.append(_junc_in[("data", elem["type"], i)])

			done_type[elem["type"]] = temp
		
		# Check if every single array in done_type have same length
		base_len = -1
		base_type = None
		for key in done_type:
			curr_len = len(done_type[key])
			if base_len == -1:
				base_len = curr_len
				base_type = key
			elif curr_len != base_len:
				print("\033[93m" + f"[Comfy-0246 WARNING] Type \"{key}\" has different amount (node {_id}, got {curr_len}, want {base_len} from first type \"{base_type}\")." + "\033[0m")
	else:
		for key in _junc_in.path_iter(("type", )):
			track[key[1]] = 0

		for elem in _type["out"]:
			if elem["full_name"] in utils0246.BLACKLIST:
				continue

			total = _junc_in.path_count(("data", elem["type"]))
			if total == 0:
				raise Exception(f"Type \"{elem['type']}\" of output \"{elem['full_name']}\" does not available in junction.")
			
			offset = _junc_in[("index", elem["type"])]
			real_index = track[elem["type"]] + offset

			if real_index >= total:
				raise Exception(f"Too much type \"{elem['type']}\" being taken or offset \"{offset}\" is too large (count: \"{total}\").")
			
			res.append(_junc_in[("data", elem["type"], real_index)])
			track[elem["type"]] += 1
	
	return (_junc_in, ) + tuple(res)

def gather_impl(_dict_list):
	new_dict = utils0246.RevisionDict()

	if _dict_list is None:
		return new_dict

	count_track = {}

	for _dict in _dict_list:
		for type_name in _dict.path_iter(("type", )):
			if type_name[1] not in count_track:
				count_track[type_name[1]] = 0
				new_dict[("type", type_name[1])] = type_name[1]
			total = _dict.path_count(("data", type_name[1]))
			for i in range(total):
				new_dict[("data", type_name[1], i + count_track[type_name[1]])] = _dict[("data", type_name[1], i)]
			new_dict[("index", type_name[1])] = 0
			count_track[type_name[1]] += total

	return new_dict

def update_hold_db(key, data):
	if data is not None:
		Hold.HOLD_DB[key]["data"].extend(data)
	return [None] if not Hold.HOLD_DB[key]["data"] else Hold.HOLD_DB[key]["data"]

def len_zero_arr(data):
	return 0 if data[0] is None else len(data)

########################################################################################
######################################## HIJACK ########################################
########################################################################################

PROMPT_COUNT = 0
PROMPT_ID = None
PROMPT_EXTRA = None

def execute_param_handle(*args, **kwargs):
	global PROMPT_ID
	global PROMPT_COUNT
	if PROMPT_ID is None or PROMPT_ID != args[2]:
		PROMPT_COUNT += 1
		PROMPT_ID = args[2]
		PROMPT_EXTRA = args[3]

	return tuple(), {}

utils0246.hijack(execution.PromptExecutor, "execute", execute_param_handle)

def init_executor_param_handle(*args, **kwargs):
	return tuple(), {}

BASE_EXECUTOR = None

def init_executor_res_handle(result, *args, **kwargs):
	if not hasattr(args[0], utils0246.WRAP_DATA):
		global BASE_EXECUTOR
		if BASE_EXECUTOR is None:
			BASE_EXECUTOR = args[0]
	return result

utils0246.hijack(execution.PromptExecutor, "__init__", init_executor_param_handle, init_executor_res_handle)

BASE_TO_EXEC = None
COND_EXEC = [] # List of functions

# Just in case if we needs this ever again
def execute_node_param_handle(*args, **kwargs):
	global BASE_TO_EXEC
	BASE_TO_EXEC = args[0]

	track = 0
	while track < len(COND_EXEC):
		if COND_EXEC[track](BASE_TO_EXEC):
			COND_EXEC.pop(track)
		else:
			track += 1

	return tuple(), {}

utils0246.hijack(builtins, "sorted", execute_node_param_handle, None, None, execution)

#####################################################################################
######################################## API ########################################
#####################################################################################

@PromptServer.instance.routes.post('/0246-parse')
async def parse_handler(request):
	data = await request.json()

	# Validate json
	if data.get("input") is None:
		return aiohttp.web.json_response({
			"error": ["No input provided"]
		})

	# Parse the input string
	expr_res, order, errors = utils0246.parse_query(data["input"], utils0246.HIGHWAY_OPS)

	utils0246.highway_check(expr_res, errors)

	# Return a JSON response with the processed data
	return aiohttp.web.json_response({
		"expr": expr_res,
		"order": order,
		"error": errors
	})

######################################################################################
######################################## NODE ########################################
######################################################################################

class Highway:
	@classmethod
	def INPUT_TYPES(s):
		return {
			"required": {
				"_query": ("STRING", {
					"default": ">data; <data",
					"multiline": False
				}),
			},
			"optional": {
				"_way_in": ("HIGHWAY_PIPE", ),
			},
			"hidden": {
				"_prompt": "PROMPT",
				"_id": "UNIQUE_ID",
				"_workflow": "EXTRA_PNGINFO" # Unfortunately EXTRA_PNGINFO does not get exposed during IS_CHANGED
			}
		}

	# Amogus moment ඞ
	RETURN_TYPES = utils0246.ByPassTypeTuple(("HIGHWAY_PIPE", ))
	RETURN_NAMES = utils0246.ByPassTypeTuple(("_way_out", ))
	FUNCTION = "execute"
	CATEGORY = "0246"

	# [TODO] Potential recursion error when attempting to hook the inout in not a very specific way
		# => May have to keep a unique identifier for each class and each node instance
			# Therefore if already exist then throw error
				# => Cyclic detection in JS instead of python

	# Do not remove the "useless" _query parameter, since data need to be consumed for expanding
	def execute(self, _id = None, _prompt = None, _workflow = None, _way_in = None, _query = None, **kwargs):
		_type = _prompt[_id]["inputs"]["_type"]

		if _way_in is None:
			_way_in = utils0246.RevisionDict()
		else:
			_way_in = utils0246.RevisionDict(_way_in)

		# _way_in._id = _id
		# _way_in.purge(_way_in.find(lambda item: item.id == _id))

		# Time to let the magic play out

		for param, key in zip(_type["in"], list(kwargs)):
			name = param["name"][1:]
			_way_in[("data", name)] = kwargs[key]
			_way_in[("type", name)] = param["type"]

		res = []

		for elem in _type["out"]:
			name = elem["name"][1:]

			if (
				("data", name) in _way_in and
				elem["type"] == _way_in[("type", name)]
			) or elem["type"] == "*":
				res.append(_way_in[("data", name)])
			else:
				raise Exception(f"Output \"{name}\" is not defined or is not of type \"{elem['type']}\". Expected \"{_way_in[('type', name)]}\".")

		return (_way_in, ) + tuple(res)
	
	@classmethod
	def IS_CHANGED(self, _query, _id = None, _prompt = None, _workflow = None, _way_in = None, *args, **kwargs):
		return utils0246.check_update(_query)

######################################################################################

class Junction:
	@classmethod
	def INPUT_TYPES(s):
		return {
			"required": {
				"_offset": ("STRING", {
					"default": ";",
					"multiline": False
				}),
				# "_mode": (["named_type", "internal_type"],),
			},
			"optional": {
				"_junc_in": ("JUNCTION_PIPE", ),
			},
			"hidden": {
				"_prompt": "PROMPT",
				"_id": "UNIQUE_ID",
				"_workflow": "EXTRA_PNGINFO"
			}
		}
	
	RETURN_TYPES = utils0246.ByPassTypeTuple(("JUNCTION_PIPE", ))
	RETURN_NAMES = utils0246.ByPassTypeTuple(("_junc_out", ))
	FUNCTION = "execute"
	CATEGORY = "0246"

	def __init__(self):
		self._prev_offset = None
		self._parsed_offset = None

	def execute(self, _id = None, _prompt = None, _workflow = None, _junc_in = None, _offset = None, **kwargs):
		return junction_impl(self, _id, _prompt, _workflow, _junc_in, _offset, **kwargs)
	
	@classmethod
	def IS_CHANGED(self, _offset, _id = None, _prompt = None, _workflow = None, _junc_in = None, *args, **kwargs):
		return utils0246.check_update(_offset)

######################################################################################

class JunctionBatch:
	@classmethod
	def INPUT_TYPES(s):
		return {
			"required": {
				"_offset": ("STRING", {
					"default": ";",
					"multiline": False
				}),
				"_mode": (["pluck", "batch"], ),
			},
			"optional": {
				"_junc_in": ("JUNCTION_PIPE", ),
			},
			"hidden": {
				"_prompt": "PROMPT",
				"_id": "UNIQUE_ID",
				"_workflow": "EXTRA_PNGINFO"
			}
		}
	
	RETURN_TYPES = utils0246.ByPassTypeTuple(("JUNCTION_PIPE", ))
	RETURN_NAMES = utils0246.ByPassTypeTuple(("_junc_out", ))
	INPUT_IS_LIST = True
	FUNCTION = "execute"
	CATEGORY = "0246"

	def __init__(self):
		self._prev_offset = None
		self._parsed_offset = None

	def execute(self, _id = None, _prompt = None, _workflow = None, _junc_in = None, _offset = None, _mode = None, **kwargs):
		if isinstance(_mode, list):
			_mode = _mode[0]

		# Why not adding extra combos to manage _in_mode, _out_mode, and _offset_mode?
			# To prevent people being stupid and we force them to use correct combination

		if _mode == "batch":
			setattr(JunctionBatch, "OUTPUT_IS_LIST", utils0246.TautologyRest())
			return junction_impl(self, _id, _prompt, _workflow, gather_impl(_junc_in), _offset, _in_mode = True, _out_mode = True, _offset_mode = True, **kwargs)
		else:
			try:
				delattr(JunctionBatch, "OUTPUT_IS_LIST")
			except AttributeError:
				pass
			return junction_impl(self, _id, _prompt, _workflow, gather_impl(_junc_in), _offset, _in_mode = True, _out_mode = False, **kwargs)

	@classmethod
	def IS_CHANGED(self, _id = None, _prompt = None, _workflow = None, _offset = None, _junc_in = None, _mode = None, *args, **kwargs):
		return utils0246.check_update(_offset)

######################################################################################

class Count:
	@classmethod
	def INPUT_TYPES(s):
		return {
			"required": {
				"_node": utils0246.ByPassTypeTuple(("*", )),
				"_event": ("STRING", {
					"default": "10",
					"multiline": False
				}),
			},
			"hidden": {
				"_id": "UNIQUE_ID"
			}
		}
	
	COUNT_DB = {}
	COUNT_ID = 0
	
	RETURN_TYPES = ("INT", "EVENT_TYPE")
	RETURN_NAMES = ("_count_int", "_count_event")
	FUNCTION = "execute"
	CATEGORY = "0246"

	def execute(self, _id = None, _node = None, _event = None, **kwargs):
		global PROMPT_COUNT
		if Count.COUNT_ID != PROMPT_COUNT:
			Count.COUNT_DB = {}
			Count.COUNT_ID = PROMPT_COUNT
		if _id not in Count.COUNT_DB:
			Count.COUNT_DB[_id] = 0
		temp = Count.COUNT_DB[_id]
		Count.COUNT_DB[_id] += 1

		return {
			"ui": {
				"text": (f"Track: {Count.COUNT_ID}, Count: {temp}", )
			},
			"result": (temp, {
				"data": {
					"id": _id,
				},
				"bool": temp >= int(_event) - 1,
			})
		}

######################################################################################

class RandomInt:
	@classmethod
	def INPUT_TYPES(s):
		# Random uint64 int
		return {
			"required": {
				"val": ("STRING", {
					"default": "-1",
					"multiline": False
				}),
				"min": ("INT", {
					"default": 0,
					"min": -9007199254740991,
					"max": 9007199254740991
				}),
				"max": ("INT", {
					"default": 9007199254740991,
					"min": -9007199254740991,
					"max": 9007199254740991
				}),
				"batch_size": ("INT", {
					"default": 1,
					"min": 1,
					"max": sys.maxsize
				}),
			},
			"optional": {
				"seed": ("INT", {
					"default": 0,
					"min": -9007199254740991,
					# "max": 18446744073709551615
					"max": 9007199254740991
				}),
			},
			"hidden": {
				"_id": "UNIQUE_ID"
			}
		}

	RANDOM_DB = {}
	
	RETURN_TYPES = ("INT", )
	RETURN_NAMES = ("rand_int", )
	OTUPUT_IS_LIST = (True, )
	FUNCTION = "execute"
	CATEGORY = "0246"

	def execute(self, _id = None, val = None, min = None, max = None, seed = None, batch_size = None, **kwargs):
		if min > max:
			raise Exception("min is greater than max.")
		
		if seed is not None:
			random.seed(seed)
		
		if _id not in RandomInt.RANDOM_DB:
			RandomInt.RANDOM_DB[_id] = {
				"track": None
			}

		if RandomInt.RANDOM_DB[_id]["track"] != PROMPT_COUNT:
			RandomInt.RANDOM_DB[_id]["track"] = PROMPT_COUNT

			if seed is not None:
				random.seed(seed)
				RandomInt.RANDOM_DB[_id]["seed"] = seed
				if "state" in RandomInt.RANDOM_DB[_id]:
					del RandomInt.RANDOM_DB[_id]["state"]

		if "state" in RandomInt.RANDOM_DB[_id]:
			random.setstate(RandomInt.RANDOM_DB[_id]["state"])

		# Initialize previous values and batch size if not present
		if "prev" not in RandomInt.RANDOM_DB[_id]:
			RandomInt.RANDOM_DB[_id]["prev"] = []
		if "prev_batch_size" not in RandomInt.RANDOM_DB[_id]:
			RandomInt.RANDOM_DB[_id]["prev_batch_size"] = None

		# Check if new random values should be generated
		generate_new = len(RandomInt.RANDOM_DB[_id]["prev"]) == 0 or \
			RandomInt.RANDOM_DB[_id]["prev_batch_size"] != batch_size

		# If val is greater than -1, return it as a single-element list
		if val != "-1":
			res = val.split(",")
			for i in range(len(res)):
				if i >= len(RandomInt.RANDOM_DB[_id]["prev"]):
					RandomInt.RANDOM_DB[_id]["prev"].append(int(res[i]))
				else:
					RandomInt.RANDOM_DB[_id]["prev"][i] = int(res[i])
			return RandomInt.RANDOM_DB[_id]["prev"]

		# If val is -1 or we need to generate new random values, generate random numbers
		if val == "-1" or generate_new:
			res = [random.randint(min, max) for _ in range(batch_size)]
			RandomInt.RANDOM_DB[_id]["prev_batch_size"] = batch_size
			RandomInt.RANDOM_DB[_id]["state"] = random.getstate()

		# If val is -2 and we don't need new random values, increment previous values
		if val == "-2" and not generate_new:
			res = [x + 1 for x in RandomInt.RANDOM_DB[_id]["prev"]]

		# If val is -3 and we don't need new random values, decrement previous values
		if val == "-3" and not generate_new:
			res = [x - 1 for x in RandomInt.RANDOM_DB[_id]["prev"]]

		RandomInt.RANDOM_DB[_id]["prev"] = res

		return {
			"ui": {
				"text": (", ".join([str(x) for x in res]), )
			},
			"result": res
		}
	
	@classmethod
	def IS_CHANGED(self, val = None, min = None, max = None, batch_size = None, *args, **kwargs):
		return float("NaN")

######################################################################################

class Hold:
	@classmethod
	def INPUT_TYPES(s):
		return {
			"required": {
				"_mode": (["keep", "save", "clear"], ),
				"_key_id": ("STRING", {
					"default": "",
					"multiline": False
				}),
			},
			"optional": {
				"_data_in": utils0246.ByPassTypeTuple(("*", )),
				"_hold": ("HOLD_TYPE", )
			},
			"hidden": {
				"_id": "UNIQUE_ID"
			}
		}
	
	HOLD_DB = {}
	
	RETURN_TYPES = utils0246.ByPassTypeTuple(("*", ))
	RETURN_NAMES = ("_data_out", )
	INPUT_IS_LIST = True
	OUTPUT_IS_LIST = utils0246.TautologyAll()
	FUNCTION = "execute"
	CATEGORY = "0246"

	def execute(self, _data_in = None, _id = None, _hold = None, _mode = None, _key_id = None, **kwargs):
		mode = _mode[0] if _mode else None

		if _id[0] not in Hold.HOLD_DB:
			Hold.HOLD_DB[_id[0]] = {
				"track": PROMPT_COUNT,
				"data": []
			}

		if Hold.HOLD_DB[_id[0]]["track"] != PROMPT_COUNT:
			Hold.HOLD_DB[_id[0]]["track"] = PROMPT_COUNT

			if mode != "save":
				Hold.HOLD_DB[_id[0]]["data"] = []

		ui_text = f"Track: {Hold.HOLD_DB[_id[0]]['track']}, Id: {_id[0]}"

		# Check if _key_id is specified and process accordingly
		if _key_id and len(_key_id[0]) > 0:
			result = update_hold_db(_key_id[0], _data_in)
			ui_text += f", Size: {len_zero_arr(result)}, Key: {_key_id[0]}"
		# Check if _hold is specified and process accordingly
		elif _hold and _hold[0]:
			result = _data_in if _data_in is not None else [None]
			ui_text += f", Size: {len_zero_arr(result)}, Passed"
		else:
			# Update the outputs and HOLD_DB for _id if specified
			if _id:
				result = update_hold_db(_id[0], _data_in)
				BASE_EXECUTOR.outputs[_id[0]] = Hold.HOLD_DB[_id[0]]["data"]
				ui_text += f", Size: {len(result)}"
			else:
				result = [None]
		
		if mode == "clear":
			Hold.HOLD_DB[_id[0]]["data"] = []

		return {
			"ui": {
				"text": (ui_text,)
			},
			"result": (result,)
		}

######################################################################################

class Loop:
	@classmethod
	def INPUT_TYPES(s):
		return {
			"required": {
				"_event": ("EVENT_TYPE", ),
				"_mode": (["sweep"], ), # Reserved
				"_update": ("STRING", {
					"default": "{'update': ''}",
					"multiline": False
				}),
			},
			"hidden": {
				"_prompt": "PROMPT",
				"_id": "UNIQUE_ID",
				"_workflow": "EXTRA_PNGINFO"
			}
		}
	
	RETURN_TYPES = ("HOLD_TYPE", )
	RETURN_NAMES = ("_hold", )
	INPUT_IS_LIST = True
	FUNCTION = "execute"
	CATEGORY = "0246"

	def execute(self, _id = None, _prompt = None, _workflow = None, _event = None, _mode = None, _update = None, **kwargs):
		global BASE_EXECUTOR
		global PROMPT_ID
		if not _event[0]["bool"]:
			exec = [_id[0]]

			# [TODO] Less shitty way to remove _event from inputs
			try:
				del BASE_EXECUTOR.outputs[_prompt[0][_id[0]]["inputs"]["_event"][0]]
			except KeyError:
				pass
			
			# Not the most efficient. The better way is to find all nodes that are connected to inputs and this loop node
			trace_node(_prompt[0], _id[0], _workflow[0], _shallow = False, _input = True) # , lambda curr_id: exec.append(curr_id) if curr_id not in exec else None)

			if _mode[0] == "sweep":
				while len(exec) > 0:
					curr_id = exec.pop(0)
					if BASE_EXECUTOR.outputs.get(curr_id) is not None:
						del BASE_EXECUTOR.outputs[curr_id]
					success, error, ex = execution.recursive_execute(PromptServer.instance, _prompt[0], BASE_EXECUTOR.outputs, curr_id, {"extra_pnginfo": _workflow[0]}, set(), PROMPT_ID, BASE_EXECUTOR.outputs_ui, BASE_EXECUTOR.object_storage)
					if success is not True:
						raise ex

		return (True, )

	@classmethod
	def IS_CHANGED(self, _update = None, _event = None, _mode = None, _id = None, _prompt = None, _workflow = None, *args, **kwargs):
		return utils0246.check_update(_update)

######################################################################################

# [WIP] Incomplete, not working yet until I figure out things
class Mimic:
	@classmethod
	def INPUT_TYPES(s):
		return {
			"required": {
				"_node_class": (list(nodes.NODE_CLASS_MAPPINGS.keys()), ),
				"_mode": (["pluck", "batch"], ),
				"_data": ("STRING", {
					"default": ";",
					"multiline": True
				}),
			},
			# Can accept multiple junction and highway
				# But since text box is basically cannot be resized correctly, we need to allows nested access
			"optional": {
				"_junc_in": ("JUNCTION_PIPE", ),
				"_way_in": ("HIGHWAY_PIPE", ),
			},
			"hidden": {
				"_prompt": "PROMPT",
				"_id": "UNIQUE_ID"
			}
		}
	
	RETURN_TYPES = utils0246.ByPassTypeTuple(("*", ))
	RETURN_NAMES = utils0246.ByPassTypeTuple(("_pipe_out", )) # Accept _junc_in and _way_in only
	INPUT_IS_LIST = True # Prevent auto loop, we wants to manage it by ourselves
	FUNCTION = "execute"
	CATEGORY = "0246"

	def execute(self, _id = None, _prompt = None, _data = "", **kwargs):
		class_type = nodes.NODE_CLASS_MAPPINGS[_prompt[_id]["class_type"]]

		# Check if class_type.INPUT_TYPES have at least one input
			# Also check if have at least one output for RETURN_TYPES

		class_obj = class_type()
		# Remove class attribute MimicCore.RETURN_NAMES
		return getattr(class_obj, getattr(class_type, "FUNCTION"))(**kwargs)

######################################################################################

class Beautify:
	@classmethod
	def INPUT_TYPES(s):
		return {
			"required": {
				"data": utils0246.ByPassTypeTuple(("*", )),
				"mode": (["basic", "more", "full", "json"], ),
			},
		}
	
	RETURN_TYPES = ()
	INPUT_IS_LIST = True
	OUTPUT_NODE = True
	FUNCTION = "execute"
	CATEGORY = "0246"

	def execute(self, data = None, mode = None, **kwargs):

		raw_mode = 0
		res_str = None
		match mode[0]:
			case "basic":
				raw_mode = 0
			case "more":
				raw_mode = 1
			case "full":
				raw_mode = 2
			case "json":
				res_str = None
				try:
					res_str = json.dumps(data, indent=2)
				except TypeError:
					res_str = "Cannot convert to JSON."
		
		if res_str is None:
			res_str = utils0246.beautify_structure(data, 0, raw_mode)

		return {
			"ui": {
				"text": (res_str, )
			}
		}

######################################################################################

class Stringify:
	@classmethod
	def INPUT_TYPES(s):
		return {
			"required": {
				"_mode": (["basic", "value", "force"],),
				"_delimiter": ("STRING", {
					"default": ", ",
					"multiline": False
				}),
			},
		}
	
	RETURN_TYPES = ("STRING", )
	RETURN_NAMES = ("_str", )
	INPUT_IS_LIST = True
	FUNCTION = "execute"
	CATEGORY = "0246"

	def execute(self, _delimiter = None, _mode = None, **kwargs):
		res = []

		for value in kwargs.values():
			if isinstance(value, list):
				for item in value:
					if _mode[0] == "basic" and type(item).__str__ is object.__str__:
						continue
					elif _mode[0] == "value":
						if isinstance(item, object) and type(item).__module__ != 'builtins' and type(item).__str__ is object.__str__:
							continue
					try:
						item_str = str(item)
						if item_str:
							res.append(item_str)
					except Exception:
						continue

		res = _delimiter[0].join(res)
		return {
			"ui": {
				"text": (res, )
			},
			"result": (res, )
		}

########################################################################################
######################################## EXPORT ########################################
########################################################################################

NODE_CLASS_MAPPINGS = {
	"0246.Highway": Highway,
	"0246.Junction": Junction,
	"0246.JunctionBatch": JunctionBatch,
	# "0246.Mimic": Mimic,
	"0246.RandomInt": RandomInt,
	"0246.Count": Count,
	"0246.Hold": Hold,
	"0246.Loop": Loop,
	"0246.Beautify": Beautify,
	"0246.Stringify": Stringify,
	# "0246.Convert": Convert,
}

NODE_DISPLAY_NAME_MAPPINGS = {
	"0246.Highway": "Highway",
	"0246.Junction": "Junction",
	"0246.JunctionBatch": "Junction Batch",
	# "0246.Mimic": "Mimic",
	"0246.RandomInt": "Random Int",
	"0246.Count": "Count",
	"0246.Hold": "Hold",
	"0246.Loop": "Loop",
	"0246.Beautify": "Beautify",
	"0246.Stringify": "Stringify",
	# "0246.Convert": "Convert",
}

print("\033[95m" + utils0246.HEAD_LOG + "Loaded all nodes and apis (/0246-parse)." + "\033[0m")
