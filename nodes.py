"""
@author: Trung0246
@title: ComfyUI-0246
@nickname: ComfyUI-0246
@description: Random nodes for ComfyUI I made to solve my struggle with ComfyUI (ex: pipe, process). Have varying quality.
"""

# Built-in
import sys
import ast
import random
import builtins
import json
import copy
import functools
import copy
import re

# Self Code
from . import utils as lib0246

# 3rd Party
import aiohttp.web
import natsort

# ComfyUI
from server import PromptServer
import execution
import nodes

######################################################################################
######################################## IMPL ########################################
######################################################################################

def highway_impl(_prompt, _id, _workflow, _way_in, flag, kwargs):
	if isinstance(_prompt, list):
		_prompt = _prompt[0]
	if isinstance(_id, list):
		_id = _id[0]
	if isinstance(_workflow, list):
		_workflow = _workflow[0]

	if isinstance(_way_in, list):
		_way_in = _way_in[0]

	if _way_in is None:
		_way_in = lib0246.RevisionDict()
	else:
		_way_in = lib0246.RevisionDict(_way_in)

	# _way_in._id = _id
	# _way_in.purge(_way_in.find(lambda item: item.id == _id))

	# Time to let the magic play out
		
	curr_node = next(_ for _ in _workflow["workflow"]["nodes"] if str(_["id"]) == _id)

	for i, curr_input in enumerate(curr_node["inputs"]):
		if curr_input["name"] in kwargs:
			name = _workflow["workflow"]["extra"]["0246.__NAME__"][_id]["inputs"][str(i)]["name"][1:]
			if flag:
				_way_in[("data", name)] = lib0246.RevisionBatch(*kwargs[curr_input["name"]])
			else:
				_way_in[("data", name)] = kwargs[curr_input["name"]]
			_way_in[("type", name)] = curr_input["type"]

	res = []

	for i, curr_output in enumerate(curr_node["outputs"]):
		if curr_output.get("links") and curr_output["name"] not in lib0246.BLACKLIST:
			name = _workflow["workflow"]["extra"]["0246.__NAME__"][_id]["outputs"][str(i)]["name"][1:]
			if ("data", name) in _way_in:
				if curr_output["type"] == "*" or curr_output["type"] == _way_in[("type", name)]:
					res.append(_way_in[("data", name)])
				else:
					raise Exception(f"Output \"{name}\" is not defined or is not of type \"{curr_output['type']}\". Expected \"{_way_in[('type', name)]}\".")

	_way_in[("kind")] = "highway"
	_way_in[("id")] = _id

	return (_way_in, ) + tuple(res)

def gather_highway_impl(_dict_list, _id):
	new_dict = lib0246.RevisionDict()

	if _dict_list is None:
		return new_dict
	
	if isinstance(_id, list):
		_id = _id[0]
	
	for elem in _dict_list:
		iter_inst = elem.path_iter(("data", ))
		for key in iter_inst:
			if ("type", key[1]) not in new_dict:
				new_dict[("type", key[1])] = elem[("type", key[1])]
			if ("data", key[1]) not in new_dict:
				new_dict[("data", key[1])] = lib0246.RevisionBatch()
			if isinstance(elem[("data", key[1])], lib0246.RevisionBatch):
				new_dict[("data", key[1])].extend(elem[("data", key[1])])
			else:
				new_dict[("data", key[1])].append(elem[("data", key[1])])

	new_dict[("kind")] = "highway"
	new_dict[("id")] = _id

	return new_dict

def junction_impl(self, _id, _prompt, _workflow, _junc_in, _offset = None, _in_mode = False, _out_mode = False, _offset_mode = False, **kwargs):
	if isinstance(_prompt, list):
		_prompt = _prompt[0]
	if isinstance(_id, list):
		_id = _id[0]
	if isinstance(_offset, list):
		_offset = _offset[0]
	if isinstance(_workflow, list):
		_workflow = _workflow[0]

	if _junc_in is None:
		_junc_in = lib0246.RevisionDict()
	else:
		_junc_in = lib0246.RevisionDict(_junc_in)

	# _junc_in._id = _id
	# _junc_in.purge(_junc_in.find(lambda item: item.id == _id))

	# Pack all data from _junc_in and kwargs together with a specific format
		
	curr_node = next(_ for _ in _workflow["workflow"]["nodes"] if str(_["id"]) == _id)

	if _in_mode:
		flat_iter = lib0246.FlatIter(kwargs)
		for param, (key, value) in lib0246.flat_zip(list(filter(lambda _: _["name"] not in lib0246.BLACKLIST, curr_node["inputs"])), flat_iter):
			junction_pack_loop(_junc_in, param["type"], value)
	else:
		for param, key in zip(list(filter(lambda _: _["name"] not in lib0246.BLACKLIST, curr_node["inputs"])), list(kwargs)):
			junction_pack_loop(_junc_in, param["type"], kwargs[key])

	# Parse the offset string

	if hasattr(self, "_prev_offset") and hasattr(self, "_parsed_offset") and _offset is not None:
		if type(_offset) is str:
			_offset = ast.literal_eval(_offset)
		if _offset["data"] != self._prev_offset:
			parsed_offset, err = lib0246.parse_offset(_offset["data"])
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
	db = {}

	if _out_mode:
		done_type = {}
		for elem in curr_node["outputs"]:
			if elem["name"] in lib0246.BLACKLIST:
				continue

			if elem["type"] in done_type:
				# Rotate the list from [11, 22, 33] to [22, 33, 11]
				if elem["type"] not in db:
					db[elem["type"]] = done_type[elem["type"]]
				db[elem["type"]] = (db[elem["type"]][1:] + db[elem["type"]][:1])
				res.append(db[elem["type"]])
				continue
			
			total = _junc_in.path_count(("data", elem["type"]))
			if total == 0:
				raise Exception(f"Type \"{elem['type']}\" of output \"{elem['name']}\" does not available in junction.")
			
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
				print("\033[93m" + f"{lib0246.HEAD_LOG}WARNING: Type \"{key}\" has different amount (node {_id}, got {curr_len}, want {base_len} from first type \"{base_type}\")." + "\033[0m")
	else:
		for key in _junc_in.path_iter(("type", )):
			track[key[1]] = 0

		for elem in curr_node["outputs"]:
			if elem["name"] in lib0246.BLACKLIST:
				continue

			total = _junc_in.path_count(("data", elem["type"]))
			if total == 0:
				raise Exception(f"Type \"{elem['type']}\" of output \"{elem['name']}\" does not available in junction.")
			
			offset = _junc_in[("index", elem["type"])]
			real_index = track[elem["type"]] + offset

			if real_index >= total:
				raise Exception(f"Too much type \"{elem['type']}\" being taken or offset \"{offset}\" is too large (count: \"{total}\").")
			
			res.append(_junc_in[("data", elem["type"], real_index)])
			track[elem["type"]] += 1

	_junc_in[("kind")] = "junction"
	_junc_in[("id")] = _id
	
	return (_junc_in, ) + tuple(res)

def gather_junction_impl(_dict_list, _id):
	new_dict = lib0246.RevisionDict()

	if _dict_list is None:
		return new_dict
	
	if isinstance(_id, list):
		_id = _id[0]
		
	for _dict in _dict_list:
		for tuple_key in _dict.path_iter(("data", )):
			junction_pack_loop(new_dict, tuple_key[1], _dict[tuple_key])

	new_dict[("kind")] = "junction"
	new_dict[("id")] = _id

	return new_dict

def junction_unpack_raw(
	data_dict, param_dict, key_list, regex_inst,
	base_dict = {}, type_dict = {}, key_special=("default", "data", "index"),
	pack_func=lambda _: _, type_func=lambda _: _,
	fill_func=lambda d, k, v: d.setdefault(k, v),
	stub_flag=False,
	block=1,
):
	for key in data_dict:
		if key[0] == key_special[2]:
			type_dict[type_func(key[1])] = data_dict[key]
			
	for param_key in lib0246.dict_iter(param_dict):
		type_dict.setdefault(type_func(lib0246.dict_get(param_dict, param_key)[0]), 0)

	block_count = 0
	kill_flag = False
	def block_evt():
		nonlocal block_count
		nonlocal kill_flag
		kill_flag = True
		block_count += 1
		return block_count >= block

	param_iter = lib0246.cycle_iter(
		block_evt,
		filter(
			lambda _: _[0] in key_list,
			lib0246.dict_iter(param_dict)
		),
	)

	while block_count < block or block == sys.maxsize:
		try:
			param_key = next(param_iter)
			param_tuple = lib0246.dict_get(param_dict, param_key)
			defaults = {} if len(param_tuple) == 1 else param_tuple[1]

			regex_res: re.Match = regex_inst.match(param_key[-1])
			if regex_res is not None and regex_res.lastgroup == "_":
				continue

			data_key = (key_special[1], type_func(param_tuple[0]), type_dict.get(type_func(param_tuple[0]), 0))
			value = None
			if data_key in data_dict:
				value = data_dict[data_key]
				kill_flag = False
			elif key_special[0] in defaults and (block < sys.maxsize or stub_flag):
				if param_key[-1] in base_dict:
					break
				value = defaults[key_special[0]]
				kill_flag = False
			else:
				break
			fill_func(base_dict, param_key[-1], pack_func(value))
			type_dict[type_func(param_tuple[0])] += 1
		except StopIteration:
			break
		if kill_flag:
			break

	return base_dict

def update_hold_db(key, data):
	if data is not None:
		Hold.HOLD_DB[key]["data"].extend(data)
	return [None] if not Hold.HOLD_DB[key]["data"] else Hold.HOLD_DB[key]["data"]

def junction_pack_loop(_junc_in, name, value):
	_junc_in[("type", name)] = type(value).__name__
	count = _junc_in.path_count(("data", name))
	_junc_in[("data", name, count)] = value
	if count == 0:
		_junc_in[("index", name)] = 0

def trace_node(_prompt, _id, _workflow, _shallow = False, _input = False):
	id_stk = []
	if _input:
		for key in _prompt[_id]["inputs"]:
			if isinstance(_prompt[_id]["inputs"][key], list) and key != "_event":
				id_stk.append(_prompt[_id]["inputs"][key][0])
	else:
		id_stk.append(_id)

	id_res = set()
	
	while len(id_stk) > 0:
		curr_id = id_stk.pop(0)
		if curr_id not in id_res:
			id_res.add(curr_id)
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

	return id_res

def find_input_node(nodes, link):
	for node in nodes:
		if node.get("inputs"):
			for input in node["inputs"]:
				if input["link"] == link:
					return node["id"]
	return None

class ScriptData(dict):
	def __init__(self, data):
		super().__init__(data)

def script_node_exec(script, pin, **kwargs):
	func = getattr(script[("script", "node", "inst")], getattr(script[("script", "node", "class")], "FUNCTION"))
	if hasattr(script[("script", "node", "class")], "INPUT_IS_LIST") and script[("script", "node", "class")].INPUT_IS_LIST:
		return lib0246.transpose(func(**pin), tuple)
	else:
		return func(**pin)

def script_rule_slice(func, res, pin, **kwargs):
	return res.extend(func(pin=curr_pin) for curr_pin in lib0246.dict_slice(pin))

def script_rule_product(func, res, pin, **kwargs):
	return res.extend(func(pin=curr_pin) for curr_pin in lib0246.dict_product(pin))

def script_rule_direct(func, res, pin, **kwargs):
	return res.extend(func(pin=pin))

def highway_unpack(pipe_in, input_type, _prompt, _id, _workflow, flag = False):
	def temp_func(pin, res, **kwargs):
		if res is None:
			iter_inst = pipe_in.path_iter(("data", ))
			for key in iter_inst:
				if isinstance(pipe_in[key], lib0246.RevisionBatch):
					if key[1] in pin:
						pin[key[1]].extend(pipe_in[key])
					else:
						pin[key[1]] = pipe_in[key]
				else:
					if key[1] in pin:
						pin[key[1]].append(pipe_in[key])
					else:
						pin[key[1]] = [pipe_in[key]]
			if "hidden" in input_type:
				for key in input_type["hidden"]:
					match input_type["hidden"][key]:
						case "PROMPT":
							pin[key] = [_prompt]
						case "UNIQUE_ID":
							pin[key] = [_id]
						case "EXTRA_PNGINFO":
							pin[key] = [_workflow]
			return True
		return False
	return temp_func

def junction_unpack(pipe_in, input_type, regex_inst, flag = False):
	def temp_func(pin, res, **kwargs):
		if res is None:
			junction_unpack_raw(
				pipe_in, input_type,
				list(filter(lambda x: x != "hidden", input_type.keys())),
				base_dict=pin,
				pack_func=lambda _: [_],
				type_func=lambda _: "STRING" if isinstance(_, list) else _,
				fill_func=lambda d, k, v: d.setdefault(k, []).extend(v),
				stub_flag=True,
				regex_inst=regex_inst,
				block=sys.maxsize,
			)
			return True
		return False
	return temp_func

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

	# for node_id in args[1]:
	# 	if node_id in RandomInt.RANDOM_DB:
	# 		del RandomInt.RANDOM_DB[node_id]

	return tuple(), {}

lib0246.hijack(execution.PromptExecutor, "execute", execute_param_handle)

def init_executor_param_handle(*args, **kwargs):
	return tuple(), {}

BASE_EXECUTOR = None

def init_executor_res_handle(result, *args, **kwargs):
	if not hasattr(args[0], lib0246.WRAP_DATA):
		global BASE_EXECUTOR
		if BASE_EXECUTOR is None:
			BASE_EXECUTOR = args[0]
	return result

lib0246.hijack(execution.PromptExecutor, "__init__", init_executor_param_handle, init_executor_res_handle)

COND_EXEC = [] # List of functions

# Just in case if we needs this ever again
def execute_node_param_handle(*args, **kwargs):
	return tuple(), {}

def execute_node_res_handle(result, *args, **kwargs):
	global COND_EXEC

	for curr_id in COND_EXEC:
		result.insert(0, (0, curr_id))

	return result

lib0246.hijack(builtins, "sorted", execute_node_param_handle, None, None, execution)

# NODE_INPUT_KEYS = ["required", "optional"]
# NODE_TYPES = ["_"]

def init_extension_param_handle(*args, **kwargs):
	return tuple(), {}

def init_extension_res_handle(result, *args, **kwargs):
	global NODE_INPUT_KEYS
	global NODE_TYPES
	# [TODO] Debug NODE_TYPES on why it have empty data
	# NODE_TYPES.extend(set([x for key in NODE_INPUT_KEYS
	# 	for y in [list(nodes.NODE_CLASS_MAPPINGS[node_class].INPUT_TYPES().get(key, {}).keys())
	# 		for node_class in nodes.NODE_CLASS_MAPPINGS]
	# 	for x in y]))
	return result

lib0246.hijack(nodes, "init_custom_nodes", init_extension_param_handle, init_extension_res_handle)

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
	expr_res, order, errors = lib0246.parse_query(data["input"], lib0246.HIGHWAY_OPS)

	lib0246.highway_check(expr_res, errors)

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
	RETURN_TYPES = lib0246.ByPassTypeTuple(("HIGHWAY_PIPE", ))
	RETURN_NAMES = lib0246.ByPassTypeTuple(("_way_out", ))
	FUNCTION = "execute"
	CATEGORY = "0246"

	# [TODO] Potential recursion error when attempting to hook the inout in not a very specific way
		# => May have to keep a unique identifier for each class and each node instance
			# Therefore if already exist then throw error
				# => Cyclic detection in JS instead of python

	# Do not remove the "useless" _query parameter, since data need to be consumed for expanding
	def execute(self, _id = None, _prompt = None, _workflow = None, _way_in = None, _query = None, **kwargs):
		return highway_impl(_prompt, _id, _workflow, _way_in, False, kwargs)
	
	@classmethod
	def IS_CHANGED(self, _query, _id = None, _prompt = None, _workflow = None, _way_in = None, *args, **kwargs):
		return lib0246.check_update(_query)

######################################################################################

class HighwayBatch:
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
				"_workflow": "EXTRA_PNGINFO"
			}
		}

	RETURN_TYPES = lib0246.ByPassTypeTuple(("HIGHWAY_PIPE", ))
	RETURN_NAMES = lib0246.ByPassTypeTuple(("_way_out", ))
	INPUT_IS_LIST = True
	OUTPUT_IS_LIST = lib0246.TautologyRest()
	FUNCTION = "execute"
	CATEGORY = "0246"

	def execute(self, _id = None, _prompt = None, _workflow = None, _way_in = None, _query = None, **kwargs):
		return highway_impl(_prompt, _id, _workflow, gather_highway_impl(_way_in, _id), True, kwargs)
	
	@classmethod
	def IS_CHANGED(self, _query, _id = None, _prompt = None, _workflow = None, _way_in = None, *args, **kwargs):
		return lib0246.check_update(_query)

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
	
	RETURN_TYPES = lib0246.ByPassTypeTuple(("JUNCTION_PIPE", ))
	RETURN_NAMES = lib0246.ByPassTypeTuple(("_junc_out", ))
	FUNCTION = "execute"
	CATEGORY = "0246"

	def __init__(self):
		self._prev_offset = None
		self._parsed_offset = None

	def execute(self, _id = None, _prompt = None, _workflow = None, _junc_in = None, _offset = None, **kwargs):
		return junction_impl(self, _id, _prompt, _workflow, _junc_in, _offset, **kwargs)
	
	@classmethod
	def IS_CHANGED(self, _offset, _id = None, _prompt = None, _workflow = None, _junc_in = None, *args, **kwargs):
		return lib0246.check_update(_offset)

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
	
	RETURN_TYPES = lib0246.ByPassTypeTuple(("JUNCTION_PIPE", ))
	RETURN_NAMES = lib0246.ByPassTypeTuple(("_junc_out", ))
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
			setattr(JunctionBatch, "OUTPUT_IS_LIST", lib0246.TautologyRest())
			return junction_impl(self, _id, _prompt, _workflow, gather_junction_impl(_junc_in, _id), _offset, _in_mode = True, _out_mode = True, _offset_mode = True, **kwargs)
		else:
			try:
				delattr(JunctionBatch, "OUTPUT_IS_LIST")
			except AttributeError:
				pass
			return junction_impl(self, _id, _prompt, _workflow, gather_junction_impl(_junc_in, _id), _offset, _in_mode = True, _out_mode = False, **kwargs)

	@classmethod
	def IS_CHANGED(self, _id = None, _prompt = None, _workflow = None, _offset = None, _junc_in = None, _mode = None, *args, **kwargs):
		return lib0246.check_update(_offset)

######################################################################################

class Count:
	@classmethod
	def INPUT_TYPES(s):
		return {
			"required": {
				"_node": lib0246.ByPassTypeTuple(("*", )),
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
	INPUT_IS_LIST = True
	FUNCTION = "execute"
	CATEGORY = "0246"

	def execute(self, _id = None, _node = None, _event = None, **kwargs):
		global PROMPT_ID
		if Count.COUNT_ID != PROMPT_ID:
			Count.COUNT_DB = {}
			Count.COUNT_ID = PROMPT_ID
		if _id[0] not in Count.COUNT_DB:
			Count.COUNT_DB[_id[0]] = 0
		temp = Count.COUNT_DB[_id[0]]
		Count.COUNT_DB[_id[0]] += 1

		return {
			"ui": {
				"text": [f"Count: {temp}, Track: {Count.COUNT_ID}"]
			},
			"result": (temp, {
				"data": {
					"id": _id[0],
				},
				"bool": temp >= int(_event[0]),
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
					"default": "rand,0",
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
					"default": 2,
					"min": 1,
					"max": sys.maxsize
				}),
				"mode": (["usual", "keep", "force"], )
			},
			"optional": {
				"seed": ("INT", {
					"default": 0,
					"min": -1125899906842624,
					# "max": 18446744073709551615
					"max": 1125899906842624
				}),
			},
			"hidden": {
				"_id": "UNIQUE_ID"
			}
		}

	RANDOM_DB = {}
	
	RETURN_TYPES = ("INT", )
	RETURN_NAMES = ("rand_int", )
	INPUT_IS_LIST = True
	OUTPUT_IS_LIST = (True, )
	FUNCTION = "execute"
	CATEGORY = "0246"

	def execute(self, _id = None, val = None, min = None, max = None, seed = None, batch_size = None, mode = None, **kwargs):
		if min[0] > max[0]:
			raise Exception("Min is greater than max.")
		
		if _id[0] not in RandomInt.RANDOM_DB:
			RandomInt.RANDOM_DB[_id[0]] = {
				"track": None,
				"prev": [],
				"prev_batch_size": 0,
				"inst": random.Random(),
				"seed": seed[0],
				"flag": 0
			}

		db = RandomInt.RANDOM_DB[_id[0]]

		if db["track"] != PROMPT_ID:
			db["track"] = PROMPT_ID
			db["flag"] = 0
			if mode[0] == "keep" or db["prev_batch_size"] != batch_size[0]:
				db["prev"].clear()
				db["prev_batch_size"] = 0
				mode[0] = "force"

		raw: list = val[0].split(",")
		if len(raw) > batch_size[0]:
			raw = raw[:batch_size[0]]

		for i in range(len(raw)):
			raw[i] = raw[i].strip()
			if raw[i].isnumeric():
				lib0246.append_replace(db["prev"], i, int(raw[i]))
			else:
				if db["prev_batch_size"] != len(raw) or len(raw) <= i or raw[i] == "rand":
					if seed[0] != db["seed"] or mode[0] == "force":
						db["inst"].seed(seed[0])
						db["seed"] = seed[0]
						mode[0] = ""
					lib0246.append_replace(db["prev"], i, db["inst"].randint(min[0], max[0]))
				elif raw[i] == "add":
					if mode[0] != "force" or (db["flag"] < 1 and mode[0] == "force"):
						db["prev"][i] += 1
				elif raw[i] == "sub":
					if mode[0] != "force" or (db["flag"] < 1 and mode[0] == "force"):
						db["prev"][i] -= 1
				else:
					raise Exception(f"Invalid value \"{raw[i]}\".")

		db["prev_batch_size"] = len(raw)
		db["flag"] += 1

		msg = f"Value: {{{', '.join([str(x) for x in db['prev']])}}}, " + \
			f"Seed: {db['seed']}, " + \
			f"Track: {PROMPT_ID}"

		return {
			"ui": {
				"text": [msg]
			},
			"result": [copy.copy(db["prev"])]
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
				"_mode": (["keep", "save", "clear", "ignore"], ),
				"_key_id": ("STRING", {
					"default": "",
					"multiline": False
				}),
			},
			"optional": {
				"_data_in": lib0246.ByPassTypeTuple(("*", )),
				"_hold": ("HOLD_TYPE", )
			},
			"hidden": {
				"_id": "UNIQUE_ID"
			}
		}
	
	HOLD_DB = {}
	
	RETURN_TYPES = lib0246.ByPassTypeTuple(("*", ))
	RETURN_NAMES = ("_data_out", )
	INPUT_IS_LIST = True
	OUTPUT_IS_LIST = lib0246.TautologyAll()
	FUNCTION = "execute"
	CATEGORY = "0246"

	def execute(self, _data_in = None, _id = None, _hold = None, _mode = None, _key_id = None, **kwargs):
		mode = _mode[0] if _mode else None

		if _id[0] not in Hold.HOLD_DB:
			Hold.HOLD_DB[_id[0]] = {
				"track": PROMPT_ID,
				"data": []
			}

		if Hold.HOLD_DB[_id[0]]["track"] != PROMPT_ID:
			Hold.HOLD_DB[_id[0]]["track"] = PROMPT_ID

			if mode != "save":
				Hold.HOLD_DB[_id[0]]["data"] = []

		ui_text = f"Id: {_id[0]}, "

		# Check if _key_id is specified and process accordingly
		if _key_id and len(_key_id[0]) > 0:
			if mode == "clear":
				Hold.HOLD_DB[_key_id[0]]["data"] = []
			result = update_hold_db(_key_id[0], _data_in)
			ui_text += f"Size: {lib0246.len_zero_arr(result)}, Key: {_key_id[0]}, "
		# Check if _hold is specified and process accordingly
		elif _hold and _hold[0]:
			result = _data_in if _data_in is not None else [None]
			ui_text += f"Size: {lib0246.len_zero_arr(result)}, Passed, "
		else:
			# Update the outputs and HOLD_DB for _id if specified
			if _id:
				result = update_hold_db(_id[0], None if (mode == "ignore" and len(Hold.HOLD_DB[_id[0]]["data"]) > 0) else _data_in)
				BASE_EXECUTOR.outputs[_id[0]] = Hold.HOLD_DB[_id[0]]["data"]
				ui_text += f"Size: {len(result)}, "
				if mode == "clear":
					Hold.HOLD_DB[_id[0]]["data"] = []
			else:
				ui_text += f"None, "
				result = [None]

		ui_text += f"Track: {Hold.HOLD_DB[_id[0]]['track']}"

		return {
			"ui": {
				"text": [ui_text]
			},
			"result": [result]
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

	LOOP_DB = {}

	def execute(self, _id = None, _prompt = None, _workflow = None, _event = None, _mode = None, _update = None, **kwargs):
		global BASE_EXECUTOR
		global PROMPT_ID
		if not _event[0]["bool"]:

			# [TODO] Less shitty way to remove _event from inputs
			try:
				del BASE_EXECUTOR.outputs[_prompt[0][_id[0]]["inputs"]["_event"][0]]
			except KeyError:
				pass

			if _mode[0] == "sweep":
				if (PROMPT_ID, _id[0]) in Loop.LOOP_DB:
					Loop.LOOP_DB[(PROMPT_ID, _id[0])]["count"] += 1
					for curr_id in Loop.LOOP_DB[(PROMPT_ID, _id[0])]["exec"]:
						if curr_id in BASE_EXECUTOR.outputs:
							del BASE_EXECUTOR.outputs[curr_id]
				else:
					# Not the most efficient. The better way is to find all nodes that are connected to inputs and this loop node
					Loop.LOOP_DB[(PROMPT_ID, _id[0])] = {
						"count": 1,
						"exec": trace_node(_prompt[0], _id[0], _workflow[0], _shallow = False, _input = True) # , lambda curr_id: exec.append(curr_id) if curr_id not in exec else None)
					}
					while Loop.LOOP_DB[(PROMPT_ID, _id[0])]["count"] > 0:
						Loop.LOOP_DB[(PROMPT_ID, _id[0])]["count"] -= 1
						for curr_id in Loop.LOOP_DB[(PROMPT_ID, _id[0])]["exec"]:
							if curr_id in BASE_EXECUTOR.outputs:
								del BASE_EXECUTOR.outputs[curr_id]
						success, error, ex = execution.recursive_execute(PromptServer.instance, _prompt[0], BASE_EXECUTOR.outputs, _id[0], {"extra_pnginfo": _workflow[0]}, set(), PROMPT_ID, BASE_EXECUTOR.outputs_ui, BASE_EXECUTOR.object_storage)
						if success is not True:
							raise ex
					del Loop.LOOP_DB[(PROMPT_ID, _id[0])]

		return (True, )

	@classmethod
	def IS_CHANGED(self, _update = None, _event = None, _mode = None, _id = None, _prompt = None, _workflow = None, *args, **kwargs):
		return lib0246.check_update(_update)

######################################################################################

class Merge:
	@classmethod
	def INPUT_TYPES(s):
		return {
			"required": {
				"_mode": (["flat", "deep"], ),
				"_pad": ("STRING", {
					"default": "_",
					"multiline": False
				}, )
			},
		}
	
	RETURN_TYPES = lib0246.ByPassTypeTuple(("HIGHWAY_PIPE", "JUNCTION_PIPE", "*", ))
	RETURN_NAMES = ("_way_out", "_junc_out", "_batch_out")
	INPUT_IS_LIST = True
	OUTPUT_IS_LIST = (False, False, True)
	FUNCTION = "execute"
	CATEGORY = "0246"

	def execute(self, _pad = None, _mode = None, **kwargs):
		way = None
		junc = None
		batch = []
		batch_count = 0

		for key in kwargs:
			for i in range(len(kwargs[key])):
				curr = kwargs[key][i]

				if isinstance(curr, list):
					if _mode[0] == "deep":
						batch.extend(curr)
						batch_count += len(curr)
					else:
						batch.append(curr)
						batch_count += 1
				elif isinstance(curr, lib0246.RevisionDict):
					if curr[("kind")] == "junction":
						if junc is None:
							junc = lib0246.RevisionDict()
							junc[("kind")] = "junction"
							junc[("id")] = curr[("id")]
						for type_name in curr.path_iter(("type", )):
							total = junc.path_count(("data", type_name[1]))
							for i in range(curr.path_count(("data", type_name[1]))):
								junc[("data", type_name[1], total + i)] = curr[("data", type_name[1], i)]
							junc[("index", type_name[1])] = 0
							junc[("type", type_name[1])] = type(curr[("data", type_name[1], 0)]).__name__
					else:
						if way is None:
							way = lib0246.RevisionDict()
							way[("kind")] = "highway"
							way[("id")] = curr[("id")]
						for key_name in curr.path_iter(("type", )):
							real_key = key_name[1]
							while True:
								if ("data", real_key) not in way:
									# way[("type", real_key)] = type(curr[("data", key_name[1])]).__name__
									way[("type", real_key)] = curr[("type", key_name[1])]
									way[("data", real_key)] = curr[("data", key_name[1])]
									break
								elif _mode[0] == "deep" and curr[("type", key_name[1])] == way[("type", real_key)]:
									if not isinstance(way[("data", real_key)], list):
										way[("data", real_key)] = lib0246.RevisionBatch(*way[("data", real_key)])
									if isinstance(curr[("data", key_name[1])], list):
										way[("data", real_key)].extend(curr[("data", key_name[1])])
									else:
										way[("data", real_key)].append(curr[("data", key_name[1])])
									break
								real_key += _pad[0]
				else:
					batch.append(curr)
					batch_count += 1

		return (way, junc, batch)

######################################################################################

class Beautify:
	@classmethod
	def INPUT_TYPES(s):
		return {
			"required": {
				"data": lib0246.ByPassTypeTuple(("*", )),
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
			res_str = lib0246.beautify_structure(data, 0, raw_mode)

		return {
			"ui": {
				"text": [res_str]
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
				"text": [res]
			},
			"result": [res]
		}

######################################################################################

class BoxRange:
	@classmethod
	def INPUT_TYPES(s):
		return {
			"required": lib0246.WildDict({
				"script_box_regex": ("STRING", {
					"default": r"(?P<x>^x$)|(?P<y>^y$)|(?P<w>^width$)|(?P<h>^height$)|(^@x$)|(^@y$)|(^@w$)|(^@h$)|(^%x$)|(^%y$)|(^%w$)|(^%h$)",
					"multiline": False
				}),
				"script_order": ("STRING", {
					"default": "box",
					"multiline": False
				}),
			}),
			"hidden": {
				"_id": "UNIQUE_ID"
			}
		}

	RETURN_TYPES = lib0246.ByPassTypeTuple(("*", ))
	RETURN_NAMES = lib0246.ByPassTypeTuple(("_data", ))
	INPUT_IS_LIST = True
	OUTPUT_IS_LIST = lib0246.TautologyRest()
	FUNCTION = "execute"
	CATEGORY = "0246"

	FUNC_REGEX = functools.lru_cache(maxsize=16)(re.compile)
	FUNC_KEY_LIST = [
		"W", "H", "S8W", "S8H", "R", "A",
		"x", "y", "w", "h",
		"px", "py", "pw", "ph",
		# "rx", "ry",
		"s8x", "s8y", "s8w", "s8h",
	]

	@classmethod
	def process_box(
		cls, build_fn, box_range, box_ratio, #res_dict = None, res_list = None,
		_W = False, _H = False, _S8W = False, _S8H = False, _R = False, _A = False,
		_x = False, _y = False, _w = False, _h = False,
		_px = False, _py = False, _pw = False, _ph = False,
		# _rx = False, _ry = False,
		_s8x = False, _s8y = False, _s8w = False, _s8h = False,
	):
		if _W:
			build_fn(box_ratio["data"]["width"], "W")
		if _H:
			build_fn(box_ratio["data"]["height"], "H")
		if _S8W:
			build_fn(lib0246.snap(box_ratio["data"]["width"], 8), "S8W")
		if _S8H:
			build_fn(lib0246.snap(box_ratio["data"]["height"], 8), "S8H")
		if _R:
			build_fn(box_ratio["data"]["ratio"], "R")
		if _A:
			build_fn(box_ratio["data"]["width"] * box_ratio["data"]["height"], "A")

		for i in range(len(box_range["data"])):
			if _x:
				build_fn(lib0246.map(
					box_range["data"][i][0],
					box_range["area"][0], box_range["area"][0] + box_range["area"][2],
					0, box_ratio["data"]["width"]
				), "x")
			if _y:
				build_fn(lib0246.map(
					box_range["data"][i][1],
					box_range["area"][1], box_range["area"][1] + box_range["area"][3],
					0, box_ratio["data"]["height"]
				), "y")
			if _w:
				build_fn(lib0246.map(
					box_range["data"][i][2],
					0, box_range["area"][2],
					0, box_ratio["data"]["width"]
				), "w")
			if _h:
				build_fn(lib0246.map(
					box_range["data"][i][3],
					0, box_range["area"][3],
					0, box_ratio["data"]["height"]
				), "h")
			if _px:
				build_fn(lib0246.norm(
					box_range["data"][i][0],
					box_range["area"][0], box_range["area"][0] + box_range["area"][2]
				), "px")
			if _py:
				build_fn(lib0246.norm(
					box_range["data"][i][1],
					box_range["area"][1], box_range["area"][1] + box_range["area"][3]
				), "py")
			if _pw:
				build_fn(box_range["data"][i][2] / box_range["area"][2], "pw")
			if _ph:
				build_fn(box_range["data"][i][3] / box_range["area"][3], "ph")
			# if _rx:
			# 	res["rx"].append(box_range["data"][i][0])
			# if _ry:
			# 	res["ry"].append(box_range["data"][i][1])
			if _s8x:
				build_fn(lib0246.snap(lib0246.map(
					box_range["data"][i][0],
					box_range["area"][0], box_range["area"][0] + box_range["area"][2],
					0, box_ratio["data"]["width"]
				), 8), "s8x")
			if _s8y:
				build_fn(lib0246.snap(lib0246.map(
					box_range["data"][i][1],
					box_range["area"][1], box_range["area"][1] + box_range["area"][3],
					0, box_ratio["data"]["height"]
				), 8), "s8y")
			if _s8w:
				build_fn(lib0246.snap(lib0246.map(
					box_range["data"][i][2],
					0, box_range["area"][2],
					0, box_ratio["data"]["width"]
				), 8), "s8w")
			if _s8h:
				build_fn(lib0246.snap(lib0246.map(
					box_range["data"][i][3],
					0, box_range["area"][3],
					0, box_ratio["data"]["height"]
				), 8), "s8h")

	@classmethod
	def process_box_batch(cls, batch, data, name):
		curr_index = BoxRange.FUNC_KEY_LIST.index(name)
		if curr_index >= 0:
			batch[curr_index].append(data)

	def execute(self, _id = None, script_box_regex = None, script_order = None, box_range = None, box_ratio = None):
		if isinstance(script_box_regex, list):
			script_box_regex = script_box_regex[0]
		if isinstance(script_order, list):
			script_order = script_order[0]
		if isinstance(box_range, list):
			box_range = box_range[0]
		if isinstance(box_ratio, list):
			box_ratio = box_ratio[0]

		full_res = [None]

		script_regex: re.Pattern = BoxRange.FUNC_REGEX(script_box_regex)

		batch_res = []
		for i in range(len(BoxRange.FUNC_KEY_LIST)):
			batch_res.append([])

		BoxRange.process_box(
			lambda _, name: BoxRange.process_box_batch(batch_res, _, name),
			box_range, box_ratio,
			**{("_" + key): script_regex.match("@" + key) is not None for key in BoxRange.FUNC_KEY_LIST}
		)

		for i in range(len(batch_res)):
			if len(batch_res[i]) > 0:
				full_res.append(batch_res[i])

		if len(script_regex.groupindex.keys() & BoxRange.FUNC_KEY_LIST) > 0:
			def temp_func(pin, res, **kwargs):
				if res is None:
					result = {key: [] for key in BoxRange.FUNC_KEY_LIST}
					track = {key: 0 for key in BoxRange.FUNC_KEY_LIST}
					for pin_key in pin:
						temp = script_regex.match(pin_key)
						if temp:
							for res_key in result:
								if temp.groupdict().get(res_key, None) is not None:
									pin[pin_key] = result[res_key]
									track[res_key] += 1
					BoxRange.process_box(
						lambda _, name: result[name].append(_),
						box_range, box_ratio,
						**{("_" + key): track[key] > 0 for key in BoxRange.FUNC_KEY_LIST}
					)
					return True
				return False
			full_res[0] = ScriptData({
				"id": _id,
				"func": temp_func,
				"order": script_order,
				"kind": "wrap"
			})
		else:
			full_res[0] = {
				"box": box_range,
				"dim": box_ratio
			}

		BoxRange.process_box(
			lambda _, name: full_res.append([_]),
			box_range, box_ratio,
			**{("_" + key): script_regex.match("%" + key) is not None for key in BoxRange.FUNC_KEY_LIST}
		)

		return full_res
	
	@classmethod
	def IS_CHANGED(self, script_box_regex = None, script_order = None, box_range = {}, box_ratio = {}, *args, **kwargs):
		if isinstance(box_range, list):
			box_range = box_range[0]
		return box_range

######################################################################################

class ScriptNode:
	@classmethod
	def INPUT_TYPES(s):
		return {
			"required": {
				"script_node": (list(nodes.NODE_CLASS_MAPPINGS.keys()), ),
				"script_pin_order": ("STRING", {
					"default": "",
					"multiline": False
				}),
				"script_pin_mode": (["pin_highway", "pin_junction", "pin_direct"], ),
				"script_res_order": ("STRING", {
					"default": "",
					"multiline": False
				}),
				"script_res_mode": (["res_junction", "res_highway_batch"], ),
				"script_ignore_regex": ("STRING", {
					"default": r"(?P<_>^$)",
					"multiline": False
				}),
			},
			"optional": {
				"pipe_in": lib0246.ByPassTypeTuple(("*", )),
			},
			"hidden": {
				"_prompt": "PROMPT",
				"_id": "UNIQUE_ID",
				"_workflow": "EXTRA_PNGINFO"
			}
		}
	
	RETURN_TYPES = (lib0246.TautologyStr("*"), "SCRIPT_DATA", "SCRIPT_DATA", "SCRIPT_DATA")
	RETURN_NAMES = ("pipe_out", "script_pin_data", "script_exec_data", "script_res_data")
	INPUT_IS_LIST = False
	OUTPUT_IS_LIST = lib0246.ContradictAll()
	FUNCTION = "execute"
	CATEGORY = "0246"

	FUNC_REGEX = functools.lru_cache(maxsize=16)(re.compile)

	def execute(
			self,
			_id = None, _prompt = None, _workflow = None,
			pipe_in = None,
			script_node = None,
			script_pin_order = None, script_pin_mode = None,
			script_res_order = None, script_res_mode = None,
			script_ignore_regex = None,
			**kwargs
		):

		pin_func = None
		res_func = None
		pipe_flag = pipe_in is not None and isinstance(pipe_in, lib0246.RevisionDict)

		class_type = nodes.NODE_CLASS_MAPPINGS[script_node]

		input_type = getattr(class_type, "INPUT_TYPES")()
		if "required" not in input_type or len(input_type["required"]) == 0:
			raise Exception(f"Node class {_prompt[_id]['class_type']} does not have any required input.")
		
		output_type = getattr(class_type, "RETURN_TYPES")
		if len(output_type) == 0:
			raise Exception(f"Node class {_prompt[_id]['class_type']} does not have any output.")

		match script_pin_mode:
			case "pin_highway" if pipe_flag and pipe_in[("kind")] == "highway":
				pin_func = highway_unpack(pipe_in, input_type, _prompt, _id, _workflow)
			case "pin_junction" if pipe_flag and pipe_in[("kind")] == "junction":
				pin_func = junction_unpack(pipe_in, input_type, ScriptNode.FUNC_REGEX(script_ignore_regex))
			case "pin_direct":
				raise Exception("pin_direct is not supported yet.")
			case _:
				pass

		match script_res_mode:
			case "res_junction":
				def temp_func(res, **kwargs):
					if res is not None:
						old_res = copy.copy(res)
						res.clear()
						res.append([lib0246.RevisionDict()])

						for curr_data in old_res:
							for type_name, curr_elem in zip(output_type, curr_data):
								junction_pack_loop(res[0][0], type_name, curr_elem)
						res[0][0][("kind")] = "junction"
						res[0][0][("id")] = _id

						return True
					return False
				res_func = temp_func
			case "res_highway_batch":
				def temp_func(res, **kwargs):
					if res is not None:
						old_res = copy.copy(res)
						res.clear()
						res.append([lib0246.RevisionDict()])

						name_list = getattr(class_type, "RETURN_NAMES") if hasattr(class_type, "RETURN_NAMES") else output_type
						for data_curr in old_res:
							for type_curr, name_curr, count in zip(output_type, name_list, range(len(output_type))):
								res[0][0][("type", name_curr)] = type_curr
								if ("data", name_curr) not in res[0][0]:
									res[0][0][("data", name_curr)] = lib0246.RevisionBatch()
								res[0][0][("data", name_curr)].append(data_curr[count])

						res[0][0][("kind")] = "highway"
						res[0][0][("id")] = _id
						return True
					return False
				res_func = temp_func
			case _:
				pass

		return (
			pipe_in,
			None if pin_func is None else ScriptData({
				"id": _id,
				"func": pin_func,
				"order": script_pin_order,
				"kind": "wrap"
			}), ScriptData({
				"id": _id,
				"node_name": script_node,
				"node_class": class_type,
				"node_inst": class_type(),
				"func": script_node_exec,
				"kind": "exec"
			}),
			None if res_func is None else ScriptData({
				"id": _id,
				"func": res_func,
				"order": script_res_order,
				"kind": "wrap"
			})
		)

######################################################################################

class ScriptPile:
	@classmethod
	def INPUT_TYPES(s):
		return {
			"required": {
				"pipe_in": (lib0246.TautologyStr("*"), ),
				"script_rule_loop_mode": (["_", "slice", "cycle"], ),
				"script_rule_regex": ("STRING", {
					"default": r"(?P<m>^(@model|%MODEL)$)|(?P<c>^(@clip|%CLIP)$)|(?P<_>^$)",
					"multiline": False
				}),
				"script_rule_pin_mode": ([
					# {a: [11, 22], b: [33.0, 44.0]} => {..., a: 11, b: 33.0, ...}, {..., a: 22, b: 44.0, ...}
					"pin_highway_batch",

					# {a: junc(11, 22), b: junc(33.0, 44.0)} => {..., a: 11, b: 33.0, ...}, {..., a: 22, b: 44.0, ...}
					"pin_highway_junction",

					# junc({a: 11, b: 33.0}, {a: 22, b: 44.0}) => {..., a: 11, b: 33.0, ...}, {..., a: 22, b: 44.0, ...}
					"pin_junction_highway",

					# junc(11, 22, 33.0, 44.0, 33, 44) => {..., a: 11, b: 33.0, c: 22, ...}, {..., a: 33, b: 44.0, c: 44, ...}
					"pin_junction"
				], ),
				"count": ("INT", {
					"default": 0,
					"min": 0,
					"max": sys.maxsize
				}),
			},
			"hidden": {
				"_prompt": "PROMPT",
				"_id": "UNIQUE_ID",
				"_workflow": "EXTRA_PNGINFO"
			}
		}
	
	RETURN_TYPES = (lib0246.TautologyStr("*"), "SCRIPT_DATA", )
	RETURN_NAMES = ("pipe_out", "script_rule_data", )
	OUTPUT_IS_LIST = (False, False, )
	FUNCTION = "execute"
	CATEGORY = "0246"

	FUNC_REGEX = functools.lru_cache(maxsize=16)(re.compile)

	@classmethod
	@functools.lru_cache(maxsize=16)
	def build_pile(cls, script_name, script_type, pin_key, script_rule_regex):
		pile_data = {
			"data": {},
			"type": {}
		}
		count = 0
		for curr_pin in pin_key:
			curr_match_pin: re.Match = script_rule_regex.match("@" + curr_pin)
			if curr_match_pin:
				for (i, curr_out), curr_type in zip(enumerate(script_name), script_type):
					curr_match_out: re.Match = script_rule_regex.match("%" + curr_out)
					if curr_match_out and curr_match_out.lastgroup == curr_match_pin.lastgroup:
						pile_data["data"][(curr_out, curr_type)] = (i, curr_pin, count)
						count += 1
						if curr_type not in pile_data["type"]:
							pile_data["type"][curr_type] = 0
						pile_data["type"][curr_type] += 1
						break
				else:
					raise Exception(f"Missing corresponding output for input \"{curr_pin}\".")
		return pile_data
	
	@classmethod
	def process(cls, pile_data, pipe_iter, curr_func, count, script, func, pin, res, **kwargs):
		curr_count = 0
		pin.update(next(pipe_iter))

		while True:
			flag = 0

			temp_res = func(pin=pin) if \
				curr_func is None else (
					list(func(pin=curr_raw_pin) \
						for curr_raw_pin in curr_func(pin))
				)

			curr_count += 1

			try:
				pin.update(next(pipe_iter))
			except StopIteration:
				flag += 1

			if flag > 0 or (count > 0 and curr_count >= count):
				res.extend(temp_res)
				return True
			
			temp_res = list(lib0246.transpose(list(temp_res), list))
			pin.update({
				curr_pin: temp_res[i] for i, curr_pin, _ in pile_data["data"].values()
			})

	def execute(
		self, _id = None, _prompt = None, _workflow = None,
		script_rule_regex = None, script_rule_loop_mode = None, script_rule_pin_mode = None,
		count = None, pipe_in = None
	):
		script_rule_regex = ScriptPile.FUNC_REGEX(script_rule_regex)

		curr_func = None
		match script_rule_loop_mode:
			case "cycle":
				curr_func = lib0246.dict_product
			case "slice":
				curr_func = lib0246.dict_slice
			case "_":
				pass
			case other:
				raise Exception(f"Script rule loop mode \"{other}\" is not supported yet.")
			
		def temp_func(script, func, pin, res, **kwargs):
			pile_data = ScriptPile.build_pile(
				tuple(
					getattr(script[("script", "node", "class")], "RETURN_NAMES") if \
					hasattr(script[("script", "node", "class")], "RETURN_NAMES") else \
					getattr(script[("script", "node", "class")], "RETURN_TYPES")
				),
				tuple(getattr(script[("script", "node", "class")], "RETURN_TYPES")),
				tuple(pin.keys()),
				script_rule_regex
			)

			match script_rule_pin_mode:
				case "pin_highway_batch":
					return ScriptPile.process(
						pile_data, lib0246.dict_slice({
							(key[1]): pipe_in[key] for key in pipe_in.path_iter(("data", ))
						}, lambda _: [_]),
						curr_func, count,
						script, func, pin, res
					)

				case "pin_junction":
					raw_input_type = script[("script", "node", "class")].INPUT_TYPES()
					
					pin_key_set = set(pin.keys())
					node_key_set = set(map(
						lambda _: _[1],
						filter(
							lambda _: _[0] != "hidden",
							lib0246.dict_iter(raw_input_type)
						)
					))
					diff_key_set = (pin_key_set - node_key_set) | (node_key_set - pin_key_set)

					if len(diff_key_set) == 0:
						raise Exception("No input and output to pile up.")

					input_type = {}
					for input_key in lib0246.dict_iter(raw_input_type):
						if input_key[1] in diff_key_set:
							lib0246.dict_set(input_type, input_key, lib0246.dict_get(raw_input_type, input_key))

					data_dict = junction_unpack_raw(
						pipe_in, input_type,
						list(filter(lambda x: x != "hidden", input_type.keys())),
						base_dict={
							k: [] for k in diff_key_set
						},
						pack_func=lambda _: [_],
						type_func=lambda _: "STRING" if isinstance(_, list) else _,
						fill_func=lambda d, k, v: d.setdefault(k, []).extend(v),
						regex_inst=script_rule_regex,
						block=sys.maxsize
					)

					return ScriptPile.process(
						pile_data, lib0246.dict_slice(data_dict, lambda _: [_]),
						curr_func, count,
						script, func, pin, res
					)

				case other:
					raise Exception(f"Script rule pin mode \"{other}\" is not supported yet.")
				
			return False

		return (pipe_in, ScriptData({
			"id": _id,
			"func": temp_func,
			"kind": "rule"
		}), )

######################################################################################

class ScriptRule:
	@classmethod
	def INPUT_TYPES(s):
		return {
			"required": {
				"script_rule_mode": (["_", "slice", "cycle"], ),
			},
			"hidden": {
				"_id": "UNIQUE_ID",
			}
		}
	
	RETURN_TYPES = ("SCRIPT_DATA", )
	RETURN_NAMES = ("script_rule_data", )
	OUTPUT_IS_LIST = (False, )
	FUNCTION = "execute"
	CATEGORY = "0246"

	def execute(
		self, _id = None, script_rule_mode = None
	):
		rule_data = None
		
		if script_rule_mode is not None:
			if script_rule_mode == "_":
				rule_data = ScriptData({
					"id": _id,
					"func": script_rule_direct,
					"kind": "rule"
				})
			else:
				match script_rule_mode:
					case "slice":
						rule_data = ScriptData({
							"id": _id,
							"func": script_rule_slice,
							"kind": "rule"
						})
					case "cycle":
						rule_data = ScriptData({
							"id": _id,
							"func": script_rule_product,
							"kind": "rule"
						})
					case _:
						raise Exception(f"Invalid rule mode \"{script_rule_mode}\".")
					
		return (rule_data, )

######################################################################################

class Script:
	@classmethod
	def INPUT_TYPES(s):
		return {
			"required": {
				"_exec_mode": (["pass", "act"], ),
				"_sort_mode": ("STRING", {
					"default": "INT",
					"multiline": False
				}),
			},
			"optional": {
				"_script_in": ("SCRIPT_PIPE", ),
			},
			"hidden": {
				"_prompt": "PROMPT",
				"_id": "UNIQUE_ID",
				"_workflow": "EXTRA_PNGINFO"
			}
		}
	
	RETURN_TYPES = lib0246.ByPassTypeTuple(("SCRIPT_PIPE", ))
	RETURN_NAMES = lib0246.ByPassTypeTuple(("_script_out", ))
	INPUT_IS_LIST = True
	OUTPUT_IS_LIST = lib0246.TautologyRest()
	FUNCTION = "execute"
	CATEGORY = "0246"

	def execute(self, _id = None, _prompt = None, _workflow = None, _exec_mode = None, _sort_mode = None, _script_in = None, **kwargs):
		if isinstance(_prompt, list):
			_prompt = _prompt[0]
		if isinstance(_id, list):
			_id = _id[0]
		if isinstance(_workflow, list):
			_workflow = _workflow[0]

		if isinstance(_exec_mode, list):
			_exec_mode = _exec_mode[0]
		if isinstance(_sort_mode, list):
			_sort_mode = _sort_mode[0]

		if _script_in is None or len(_script_in) == 0:
			_script_in = lib0246.RevisionDict()
		else:
			_script_in = lib0246.RevisionDict(_script_in[0])

		script_wrap_count = _script_in.path_count(("script", "wrap"))

		for key in kwargs:
			for elem in kwargs[key]:
				if isinstance(elem, ScriptData):
					match elem["kind"]:
						case "exec" if "func" in elem:
							_script_in[("script", "exec")] = elem["func"]
							if "node_name" in elem:
								_script_in[("script", "node", "name")] = elem["node_name"]
								_script_in[("script", "node", "class")] = elem["node_class"]
								_script_in[("script", "node", "inst")] = elem["node_inst"]
						case "rule":
							_script_in[("script", "rule")] = elem["func"]
						case "wrap":
							_script_in[("script", "wrap", script_wrap_count)] = elem["func"]
							_script_in[("script", "order", script_wrap_count)] = elem["order"]
							_script_in[("script", "id", script_wrap_count)] = elem["id"]
							script_wrap_count += 1
				else:
					curr_nodes = _workflow["workflow"]["nodes"]
					node_index = next(i for i, _ in enumerate(curr_nodes) if _["id"] == int(_id))
					_script_in[("script", "data", next(_ for _ in curr_nodes[node_index]["inputs"] if _["name"] == key).get("label", key))] = elem

		pin = None
		res = []

		if _exec_mode == "act":
			# INT FLOAT UNSIGNED SIGNED REAL NOEXP NUMAFTER PATH COMPATIBILITYNORMALIZE
			# LOCALE LOCALEALPHA LOCALENUM IGNORECASE LOWERCASEFIRST GROUPLETTERS CAPITALFIRST
			# UNGROUPLETTERS NANLAST PRESORT

			_script_in.sort(
				("script", "order"), ("script", "wrap"),
				functools.reduce(
					lambda x, y: x | y,
					map(lambda _: getattr(natsort.ns, _.strip().upper()), _sort_mode.split(" "))
				)
			)

			inst = {
				"id": [_id],
				"prompt": _prompt,
				"workflow": _workflow,
			}

			pin = {}

			for key in _script_in.path_iter_arr(("script", "wrap")):
				if _script_in[key](script=_script_in, inst=inst, pin=pin, res=None):
					inst["id"].append(_script_in[("script", "id", key[2])])

			if ("script", "rule") in _script_in:
				_script_in[("script", "rule")](
					script=_script_in, inst=inst, pin=pin, res=res,
					func=functools.partial(
						_script_in.get(("script", "exec"), lambda *args, **kwargs: None),
						script=_script_in, inst=inst
					)
				)
			else:
				res.extend(_script_in[("script", "exec")](script=_script_in, inst=inst, pin=pin, res=res))

			inst["id"].clear()
			inst["id"].append(_id)

			for key in _script_in.path_iter_arr(("script", "wrap")):
				if _script_in[key](script=_script_in, inst=inst, pin=pin, res=res):
					inst["id"].append(_script_in[("script", "id", key[2])])

			res = lib0246.transpose(res, list)

		_script_in[("kind")] = "script"
		_script_in[("id")] = _id

		return {
			"ui": {
				"text": [""]
			},
			"result": [_script_in, *res]
		}

######################################################################################

class Hub:
	@classmethod
	def INPUT_TYPES(s):
		return {
			"required": lib0246.WildDict(),
			"hidden": {
				"_prompt": "PROMPT",
				"_id": "UNIQUE_ID",
				"_workflow": "EXTRA_PNGINFO"
			}
		}
	
	RETURN_TYPES = lib0246.TautologyDictStr()
	INPUT_IS_LIST = True
	OUTPUT_IS_LIST = lib0246.TautologyAll()
	FUNCTION = "execute"
	CATEGORY = "0246"

	SPECIAL = ["__PIPE__", "__BATCH_PRIM__", "__BATCH_COMBO__"]

	def execute(self, _id = None, _prompt = None, _workflow = None, **kwargs):
		# [TODO] Maybe set OUTPUT_IS_LIST depends on widget?
			# And allow dumping "node:..."?
		
		res_data = {}
		temp_data = {}
		type_data = {}
		name_data = {}

		curr_nodes = _workflow[0]["workflow"]["nodes"]
		self_index = next(i for i, _ in enumerate(curr_nodes) if _["id"] == int(_id[0]))
		curr_extra = _workflow[0]["workflow"]["extra"]

		for i, pin in enumerate(curr_nodes[self_index]["outputs"]):
			if pin["name"] in kwargs:
				if pin["name"].startswith("sole"):
					curr_type = curr_extra["0246.HUB_DATA"][_id[0]]["sole_type"][pin["name"]][-1]
					curr_index = next(i for i, _ in enumerate(curr_nodes[self_index]["outputs"]) if _["name"] == pin["name"])
					name_data[curr_index] = pin["name"]
					match curr_type:
						case "__BATCH_PRIM__" | "__BATCH_COMBO__" | "__PIPE__":
							temp_data[curr_index] = kwargs[pin["name"]][0]
						case _:
							res_data[curr_index] = kwargs[pin["name"]]
							type_data[curr_index] = curr_type
			else:
				res_data[i] = [None]

		for index_temp in temp_data:
			match curr_extra["0246.HUB_DATA"][_id[0]]["sole_type"][name_data[index_temp]][-1]:
				case "__BATCH_PRIM__":
					res_data[index_temp] = []
					for index_type in type_data:
						if type_data[index_type] == temp_data[index_temp]:
							res_data[index_temp].extend(res_data[index_type])
				case "__BATCH_COMBO__":
					res_data[index_temp] = []
					for index_type in type_data:
						if name_data[index_type].endswith(temp_data[index_temp] + ":COMBO"):
							res_data[index_temp].extend(res_data[index_type])
				case "__PIPE__":
					if temp_data[index_temp] == "HIGHWAY_PIPE":
						temp_res_data = lib0246.RevisionDict()
						for index_type in type_data:
							curr_list = curr_extra["0246.HUB_DATA"][_id[0]]["sole_type"][name_data[index_type]]
							name = curr_list[5] if len(curr_list) == 7 else index_type
							temp_res_data[("data", name)] = res_data[index_type]
							temp_res_data[("type", name)] = curr_list[-1]
						temp_res_data[("kind")] = "highway"
						temp_res_data[("id")] = _id[0]
						res_data[index_temp] = [temp_res_data]
					elif temp_data[index_temp] == "JUNCTION_PIPE":
						temp_res_data = lib0246.RevisionDict()
						for index_type in type_data:
							for value in res_data[index_type]:
								junction_pack_loop(
									temp_res_data,
									curr_extra["0246.HUB_DATA"][_id[0]]["sole_type"][name_data[index_type]][-1],
									value,
								)
						temp_res_data[("kind")] = "junction"
						temp_res_data[("id")] = _id[0]
						res_data[index_temp] = [temp_res_data]
					else:
						raise Exception(f"Invalid pipe type \"{temp_data[index_temp]}\".")
					
		if len(res_data) == 0:
			raise Exception("No output.")

		return {
			"ui": {
				"text": [""]
			},
			"result": [res_data[i] for i in range(len(res_data))]
		}

######################################################################################

CLOUD_METHOD = {
	"text": {
		"func": False, # Can be used as function
		"bind": False, # Can affect other clouds if itself is affected
		"many": False, # Can output multiple clouds
		"sole": False # Can only exist once for same kind within a group
	},
	"weight": {
		"func": True,
		"bind": False,
		"many": False,
		"sole": True,
	},
	"rand": {
		"func": True,
		"bind": True,
		"many": True,
		"sole": True,
	},
	"cycle": {
		"func": True,
		"bind": True,
		"many": True,
		"sole": True,
	},
	"merge": {
		"func": True,
		"bind": True,
		"many": False,
		"sole": True,
	},
}

class Cloud:
	@classmethod
	def INPUT_TYPES(s):
		return {
			"required": lib0246.WildDict(),
			"optional": {
				"_cloud_in": ("CLOUD_PIPE", ),
			},
			"hidden": {
				"_prompt": "PROMPT",
				"_id": "UNIQUE_ID",
				"_workflow": "EXTRA_PNGINFO"
			}
		}
	
	RETURN_TYPES = lib0246.ByPassTypeTuple(("CLOUD_PIPE", ))
	RETURN_NAMES = lib0246.ByPassTypeTuple(("_cloud_out", ))
	INPUT_IS_LIST = True
	OUTPUT_IS_LIST = lib0246.TautologyAll()
	FUNCTION = "execute"
	CATEGORY = "0246"

	def execute(self, _id = None, _prompt = None, _workflow = None, _cloud_in = None, **kwargs):
		pass

	def text_to_cloud(self):
		pass

	def cloud_to_text(self):
		pass

######################################################################################
	
class Meta:
	@classmethod
	def INPUT_TYPES(s):
		return {
			"required": {
				"data": (lib0246.TautologyStr("*"), ),
				"query": ("STRING", {
					"default": "batch_size, pipe_size, key, name",
					"multiline": False
				}),
			},
			"hidden": {
				"_prompt": "PROMPT",
				"_id": "UNIQUE_ID",
				"_workflow": "EXTRA_PNGINFO"
			}
		}
	
	RETURN_TYPES = lib0246.TautologyDictStr()
	INPUT_IS_LIST = True
	OUTPUT_IS_LIST = lib0246.TautologyAll()
	FUNCTION = "execute"
	CATEGORY = "0246"

	def execute(self, _id = None, _prompt = None, _workflow = None, data = None, query = None, **kwargs):
		pass

########################################################################################
######################################## EXPORT ########################################
########################################################################################

# [TODO] "Meta" node to show information about highway or junction
# [TODO] "RandomInt" node can have linger seed if batch len is different

NODE_CLASS_MAPPINGS = {
	"0246.Highway": Highway,
	"0246.HighwayBatch": HighwayBatch,
	"0246.Junction": Junction,
	"0246.JunctionBatch": JunctionBatch,
	"0246.RandomInt": RandomInt,
	"0246.Count": Count,
	"0246.Hold": Hold,
	"0246.Loop": Loop,
	"0246.Beautify": Beautify,
	"0246.Stringify": Stringify,
	"0246.Merge": Merge,
	# "0246.Convert": Convert,
	"0246.BoxRange": BoxRange,
	"0246.ScriptNode": ScriptNode,
	"0246.ScriptRule": ScriptRule,
	"0246.ScriptPile": ScriptPile,
	"0246.Script": Script,
	"0246.Hub": Hub,
	# "0246.Cloud": Cloud,
	# "0246.Meta": Meta,
	# "0246.Pick": Pick,
	# "0246.StrAdd": StrAdd,
	# "0246.StrAddBatch": StrAddBatch,
}

NODE_DISPLAY_NAME_MAPPINGS = {
	"0246.Highway": "Highway",
	"0246.HighwayBatch": "Highway Batch",
	"0246.Junction": "Junction",
	"0246.JunctionBatch": "Junction Batch",
	"0246.RandomInt": "Random Int",
	"0246.Count": "Count",
	"0246.Hold": "Hold",
	"0246.Loop": "Loop",
	"0246.Beautify": "Beautify",
	"0246.Stringify": "Stringify",
	"0246.Merge": "Merge",
	# "0246.Convert": "Convert",
	"0246.BoxRange": "Box Range",
	"0246.ScriptNode": "Script Node",
	"0246.ScriptRule": "Script Rule",
	"0246.ScriptPile": "Script Pile",
	"0246.Script": "Script",
	"0246.Hub": "Hub",
	# "0246.Cloud": "Cloud",
	# "0246.Meta": "Meta",
	# "0246.Pick": "Pick",
	# "0246.StrAdd": "Str Add",
	# "0246.StrAddBatch": "Str Add Batch",
}

print("\033[95m" + lib0246.HEAD_LOG + "Loaded all nodes and apis (/0246-parse)." + "\033[0m")