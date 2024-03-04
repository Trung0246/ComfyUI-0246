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
import json
import copy
import functools
import itertools
import copy
import uuid
import unicodedata
import struct
import inspect

builtins = __import__("builtins")
re = __import__("re")

# Self Code
from . import utils as lib0246

# 3rd Party
import aiohttp.web
import natsort
import regex

# ComfyUI
import server
import execution
import nodes
import comfy.sd1_clip

comfy_graph = None
comfy_graph_utils = None

try:
	import comfy.graph as temp_graph
	import comfy.graph_utils as temp_graph_utils
	comfy_graph = temp_graph
	comfy_graph_utils = temp_graph_utils
	print("\033[95m" + f"{lib0246.HEAD_LOG}Topological Execution is detected." + "\033[0m")
except ModuleNotFoundError:
	pass

NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}

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
			_way_in[("type", name)] = curr_input.get("type", "*") # Sometimes this does not exist. Weird.

	res = []

	for i, curr_output in enumerate(curr_node["outputs"]):
		if curr_output.get("links") and curr_output["name"] not in lib0246.BLACKLIST:
			name = _workflow["workflow"]["extra"]["0246.__NAME__"][_id]["outputs"][str(i)]["name"][1:]
			if ("data", name) in _way_in:
				if curr_output["type"] == "*" or _way_in[("type", name)] == "*" or curr_output["type"] == _way_in[("type", name)]:
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

			regex_res = regex_inst.match(param_key[-1])
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

def junction_pack_loop(_junc_in, name, value):
	_junc_in[("type", name)] = type(value).__name__
	count = _junc_in.path_count(("data", name))
	_junc_in[("data", name, count)] = value
	if count == 0:
		_junc_in[("index", name)] = 0

def trace_node_func(id_stk, linked_node_id):
	id_stk.append(str(linked_node_id))

def trace_node(_prompt, _id, _workflow, _input = False, _func = trace_node_func):
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
										_func(id_stk, linked_node_id)

	return id_res

def trace_node_back(node_id, dynprompt, upstream):
	stack = [node_id]
	while len(stack) > 0:
		node_id = stack.pop()
		node_info = dynprompt.get_node(node_id)
		if "inputs" not in node_info:
			continue
		for k, v in node_info["inputs"].items():
			if comfy_graph_utils.is_link(v):
				parent_id = v[0]
				if parent_id not in upstream:
					upstream[parent_id] = []
					stack.append(parent_id)
				upstream[parent_id].append(node_id)

def trace_node_front(node_id, upstream, contained):
	stack = [node_id]
	while len(stack) > 0:
		node_id = stack.pop()
		if node_id not in upstream:
			continue
		for child_id in upstream[node_id]:
			if child_id not in contained:
				contained[child_id] = True
				stack.append(child_id)

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

def script_node_exec(node_inst, node_name, node_class, node_input, node_args, node_args_base, node_args_hide, node_args_hide_full, **kwargs):
	if "pin" in kwargs:
		func = getattr(node_inst, getattr(node_class, "FUNCTION"))
		real_pin = {k: v for k, v in kwargs["pin"].items() if k in node_args_base}
		flag = hasattr(node_class, "INPUT_IS_LIST") and node_class.INPUT_IS_LIST
		for key, kind in node_args_hide_full:
			match kind:
				case "PROMPT":
					real_pin[key] = [kwargs["inst"]["prompt"]] if flag else kwargs["inst"]["prompt"]
				case "UNIQUE_ID":
					real_pin[key] = [kwargs["inst"]["id"][-1]] if flag else kwargs["inst"]["id"][-1]
				case "EXTRA_PNGINFO":
					real_pin[key] = [kwargs["inst"]["workflow"]] if flag else kwargs["inst"]["workflow"]
		if flag:
			return lib0246.transpose(func(**real_pin), tuple)
		else:
			return func(**real_pin)
	else:
		return (node_class, node_inst, node_name, node_input, node_args, node_args_base, node_args_hide)

def script_rule_slice(func, res, pin, **kwargs):
	return res.extend(func(pin=curr_pin[0]) for curr_pin in lib0246.dict_slice(pin))

def script_rule_product(func, res, pin, **kwargs):
	return res.extend(func(pin=curr_pin[0]) for curr_pin in lib0246.dict_product(pin))

def script_rule_direct(func, res, pin, **kwargs):
	return res.extend(func(pin=pin))

def highway_unpack(pipe_in):
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
			return True
		return False
	return temp_func

def junction_unpack(pipe_in, input_type, regex_inst):
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

class EventBoolStr(str):
	def __ne__(self, other):
		return other != "EVENT_TYPE" and other != "BOOL" and other != "BOOLEAN" and other != "toggle"

CLOUD_METHOD = {
	"text": None, # Cannot be used as function if None
	"pin": None,
	"weight": {
		"bind": False, # Can affect other clouds if itself is affected
		# "many": False, # Can output multiple clouds
		"sole": True, # Can only exist once for same kind within a group
	},
	"rand": {
		"bind": True,
		# "many": True,
		"sole": True,
	},
	"cycle": {
		"bind": True,
		# "many": True,
		"sole": True,
	},
	"merge": {
		"bind": True,
		# "many": False,
		"sole": True,
	},
}

STR_BRACKET = r"([()])"
STR_REPLACE = r"\\\1"

def group_query_inst(group_dict, group_id, group_list = None, inst_curr = None):
	inst_curr = set() if inst_curr is None else inst_curr
	group_list = list(group_dict.keys()) if group_list is None else group_list
	stack = [group_id]
	seen = set()
	while len(stack) > 0:
		track_group = stack.pop()
		if track_group in seen:
			continue
		seen.add(track_group)
		if "group" in group_dict[track_group]:
			stack.extend(group_dict[track_group]["group"])
		if "inst" in group_dict[track_group]:
			for track_inst in group_dict[track_group]["inst"]:
				inst_curr.add(track_inst)
	return inst_curr

class CloudFunc:
	def __init__(self, kind):
		self.func = getattr(CloudFunc, f"func_{kind}")

	@classmethod
	def func_text(cls, obj, hold, state):
		return obj.inst[state["index"]]["widgets_values"][0]
	
	@classmethod
	def func_weight(cls, obj, hold, state):
		hold["data"] = list(map(lambda _: f"({re.sub(STR_BRACKET, STR_REPLACE, _[0])}: {lib0246.snap_place(_[1], round, 2)})", itertools.product(hold["data"], obj.inst[state["index"]]["widgets_values"][0])))
		state["index"] = None
		return []
	
	@classmethod
	def func_rand(cls, obj, hold, state):
		res = []
		inst_id = obj.inst[state["index"]]["id"]
		if inst_id not in state["data"]:
			state["data"][inst_id] = {
				"rand": random.Random(),
				"seed_mode": [],
				"seed_data": [],
				"seed_count": 0
			}

		curr_state = state["data"][inst_id]

		curr_state["seed_count"] = len(obj.inst[state["index"]]["widgets_values"][0])
		curr_seed_len = len(curr_state["seed_data"])
		if curr_state["seed_count"] > curr_seed_len:
			curr_state["seed_data"].extend([None] * (curr_state["seed_count"] - curr_seed_len))
			curr_state["seed_mode"].extend([None] * (curr_state["seed_count"] - curr_seed_len))
		elif curr_state["seed_count"] < curr_seed_len:
			curr_state["seed_data"] = curr_state["seed_data"][:curr_state["seed_count"]]
			curr_state["seed_mode"] = curr_state["seed_mode"][:curr_state["seed_count"]]

		for i, curr_seed, curr_count, curr_order, curr_mode in zip(itertools.count(start=0, step=1), *obj.inst[state["index"]]["widgets_values"]):
			if curr_state["seed_data"][i] is None or \
				curr_state["seed_mode"][i] != curr_mode or \
				state["change"]:
				curr_state["seed_data"][i] = curr_seed
				curr_state["seed_mode"][i] = curr_mode
				curr_state["rand"].seed(curr_seed)
				if curr_mode != "fix":
					PROMPT_UPDATE.add(state["id"])
			else:
				match curr_mode:
					case "fix":
						curr_state["rand"].seed(curr_seed)
					case "add":
						curr_state["seed_data"][i] += 1
						curr_state["rand"].seed(curr_state["seed_data"][i])
					case "sub":
						curr_state["seed_data"][i] -= 1
						curr_state["rand"].seed(curr_state["seed_data"][i])
					case _:
						# Default to "rand" mode
						pass
			
			if curr_mode != "fix":
				PROMPT_UPDATE.add(state["id"])

			if curr_order:
				lib0246.sort_dict_of_list(hold, "index")
				res.extend(lib0246.random_order(hold["data"], min(len(hold["data"]), curr_count), curr_state["rand"]))
			else:
				choice_list: list = copy.copy(hold["data"])
				for i in range(curr_count):
					curr_choice_idx = curr_state["rand"].randint(0, len(choice_list) - 1)
					res.append(choice_list[curr_choice_idx])
					choice_list.pop(curr_choice_idx)

		for i in range(len(hold["index"])):
			hold["index"][i] = None

		return res
	
	@classmethod
	def func_cycle(cls, obj, hold, state):
		res = []
		inst_id = obj.inst[state["index"]]["id"]
		if inst_id not in state["data"]:
			state["data"][inst_id] = {
				"track_step": [],
				"track_data": [],
				"track_count": 0
			}

		curr_state = state["data"][inst_id]
			
		curr_state["track_count"] = len(obj.inst[state["index"]]["widgets_values"][0])
		curr_track_len = len(curr_state["track_data"])
		if curr_state["track_count"] > curr_track_len:
			curr_state["track_data"].extend([None] * (curr_state["track_count"] - curr_track_len))
			curr_state["track_step"].extend([None] * (curr_state["track_count"] - curr_track_len))
		elif curr_state["track_count"] < curr_track_len:
			curr_state["track_data"] = curr_state["track_data"][:curr_state["track_count"]]
			curr_state["track_step"] = curr_state["track_step"][:curr_state["track_count"]]

		for i, curr_offset, curr_step, curr_space, curr_count in zip(itertools.count(start=0, step=1), *obj.inst[state["index"]]["widgets_values"]):
			if curr_state["track_data"][i] is None or \
				curr_state["track_step"][i] != curr_step or \
				state["change"]:
				curr_state["track_data"][i] = curr_offset
				curr_state["track_step"][i] = curr_step
				if curr_step != 0:
					PROMPT_UPDATE.add(state["id"])
			else:
				curr_state["track_data"][i] += curr_step

			if curr_step != 0:
				PROMPT_UPDATE.add(state["id"])
			
			lib0246.sort_dict_of_list(hold, "index")
			for i, track in zip(itertools.count(start=curr_state["track_data"][i], step=curr_space), range(curr_count)):
				res.append(hold["data"][i % len(hold["data"])])

		for i in range(len(hold["index"])):
			hold["index"][i] = None

		return res
	
	@classmethod
	def func_merge(cls, obj, hold, state):
		res = []

		lib0246.sort_dict_of_list(hold, "index")
		for i, curr_delim in zip(itertools.count(start=0, step=1), *obj.inst[state["index"]]["widgets_values"]):
			res.append(curr_delim.join(hold["data"]))
		
		for i in range(len(hold["index"])):
			hold["index"][i] = None

		return res

class CloudData:
	def __init__(self):
		self.inst = []
		self.group = {}
		self.db = {}

		self.state = {}
		self.func = {}
		self.track = 0
		self.order = None
		self.id = None

	def dict_to_data(self, curr_id, inst_list, group_dict, db_dict = None, kwargs = None):
		if kwargs is not None:
			self.track = PROMPT_COUNT
			self.id = curr_id
		if db_dict is not None:
			self.db.update(db_dict)
		self.db[curr_id] = self.db.get(curr_id, {})
		for inst in inst_list:
			old_id = inst["id"]
			new_id = str(uuid.uuid4())
			match inst["kind"]:
				case "pin" if kwargs is not None:
					curr_value = None
					for key in kwargs:
						curr_int = key.split(":")[0]
						if curr_int.isnumeric() and int(curr_int) == inst["widgets_values"][0]:
							curr_value = kwargs[key][0]
							break
					match curr_value:
						case CloudData():
							self.dict_to_data(curr_value.id, curr_value.inst, curr_value.group, curr_value.db, None)
							for group_id in group_dict:
								if "inst" in group_dict[group_id]:
									try:
										curr_index = group_dict[group_id]["inst"].index(old_id)
										group_dict[group_id]["inst"][curr_index:curr_index + 1] = map(lambda _: _["id"], curr_value.inst)
									except ValueError:
										pass
							continue
						case str() | int() | float():
							self.inst.append({
								"id": new_id,
								"kind": "text",
								"widgets_values": [[*map(str, kwargs[key])]],
								"widgets_names": [f"cloud:_:{new_id}:text:text_input"]
							})
				case _:
					self.inst.append(inst)
			if old_id.isnumeric():
				inst["id"] = new_id
				self.db[curr_id][new_id] = old_id

		if kwargs is not None:
			for param in kwargs:
				if param.startswith("cloud:"):
					for inst in self.inst:
						for i in range(len(inst["widgets_values"])):
							if inst["widgets_names"][i] == param:
								inst["widgets_values"][i] = kwargs[param]
								break

		for old_id, group_data in group_dict.items():
			if "inst" in group_data:
				new_list = []
				for i, inst_id in enumerate(group_data["inst"]):
					if not inst_id.isnumeric():
						new_list.append(inst_id)
					else:
						for curr_inst_id in self.db[curr_id].keys():
							if self.db[curr_id][curr_inst_id] == inst_id:
								new_list.append(curr_inst_id)
								break
				if len(new_list) > 0:
					group_data["inst"] = new_list
				else:
					del group_data["inst"]
			if "group" in group_data:
				for i, inner_old_id in enumerate(group_data["group"]):
					new_id = str(uuid.uuid4())
					if not inner_old_id.split(":")[-1].isnumeric():
						group_data["group"][i] = inner_old_id
					else:
						for curr_group_id in self.db[curr_id].keys():
							if self.db[curr_id][curr_group_id] == inner_old_id:
								group_data["group"][i] = curr_group_id
								break
			new_id = str(uuid.uuid4())
			if not old_id.split(":")[-1].isnumeric():
				self.group[old_id] = group_data
			else:
				for curr_group_id in self.db[curr_id].keys():
					if self.db[curr_id][curr_group_id] == old_id:
						self.group[curr_group_id] = group_data
						break
				else:
					self.group[new_id] = group_data
					for curr_group_id in self.db[curr_id].keys():
						if self.db[curr_id][curr_group_id] == old_id:
							break
					else:
						self.db[curr_id][new_id] = old_id

	@classmethod
	def text_to_dict(cls, text):
		old_func = comfy.sd1_clip.parse_parentheses
		comfy.sd1_clip.parse_parentheses = lib0246.parse_parentheses
		res = list(map(lambda _: (comfy.sd1_clip.unescape_important(_[0]), _[1]), comfy.sd1_clip.token_weights(comfy.sd1_clip.escape_important(text), 1.0)))
		comfy.sd1_clip.parse_parentheses = old_func
		return res

	def text_to_data(self, text):
		pass

	def data_eval(self, node_id, prompt, workflow):
		"""
		{
			eval # Evaluated data
			data # Persistent data
			order # Current instance order
			index # Current instance result index
			change # Whether whole cloud changed
		}
		"""

		self.state["eval"] = {}
		self.state["change"] = self.track == PROMPT_COUNT
		self.state["id"] = node_id
		self.state["prompt"] = prompt
		self.state["workflow"] = workflow

		if self.state["change"]:
			self.order = self.sort()
			self.func = {}
			self.state["data"] = {}
			for inst in self.inst:
				self.func[inst["id"]] = CloudFunc(inst["kind"]) if \
					isinstance(inst["kind"], str) else \
					inst["kind"]

		for i, curr_id in enumerate(self.order["idx"]):
			self.state["order"] = i
			self.state["index"] = next(i for i, _ in enumerate(self.inst) if _["id"] == curr_id)
			hold_curr = {
				"data": [],
				"index": []
			}
			for inst_id_dep in self.order["dep"][curr_id]:
				hold_curr["data"].extend(self.state["eval"][inst_id_dep]["data"])
				hold_curr["index"].extend([self.state["eval"][inst_id_dep]["index"]] * len(self.state["eval"][inst_id_dep]["data"]))
			res = self.func[curr_id].func(
				obj=self,
				hold=hold_curr,
				state=self.state
			)
			self.state["eval"][curr_id] = {
				"data": res,
				"index": self.state["index"]
			}
			i = 0
			for inst_id_dep in self.order["dep"][curr_id]:
				self.state["eval"][inst_id_dep]["index"] = hold_curr["index"][i]
				curr_len = len(self.state["eval"][inst_id_dep]["data"])
				self.state["eval"][inst_id_dep]["data"] = hold_curr["data"][i:i + curr_len]
				i += curr_len

		temp_res = []
		for curr_id in self.state["eval"]:
			curr_eval = self.state["eval"][curr_id]
			if curr_eval["index"] is not None:
				curr_eval["id"] = curr_id
				temp_res.append(curr_eval)
		temp_res.sort(key=lambda _: _["index"])

		return sum((curr_eval["data"] for curr_eval in temp_res), [])

	def sort(self):
		dep = {}

		for group_id in self.group:
			inst_list = group_query_inst(self.group, group_id)
			inst_dep_list_prim = []
			inst_dep_list_func = []
			inst_dep_list_bind = []
			inst_kind_set = set()

			for inst_id in inst_list:
				if inst_id not in dep:
					dep[inst_id] = []
				inst_curr_kind = next(filter(lambda _: _["id"] == inst_id, self.inst))["kind"]
				if CLOUD_METHOD[inst_curr_kind] is None:
					inst_dep_list_prim.append(inst_id)
				else:
					if inst_curr_kind in inst_kind_set and CLOUD_METHOD[inst_curr_kind]["sole"]:
						raise Exception(f"Cannot have multiple {inst_curr_kind} cloud to same group {group_id}.")
					(inst_dep_list_bind if CLOUD_METHOD[inst_curr_kind]["bind"] else inst_dep_list_func).append(inst_id)
					if isinstance(inst_curr_kind, str):
						inst_kind_set.add(inst_curr_kind)

			for inst_id in inst_dep_list_func:
				dep[inst_id].extend(inst_dep_list_prim)
				dep[inst_id].extend(inst_dep_list_bind)

			idx_db = {}
			for inst_id in inst_dep_list_bind:
				dep[inst_id].extend(inst_dep_list_prim)
				# dep[inst_id].extend(inst_dep_list_func)
				idx_db[inst_id] = self.inst.index(next(filter(lambda _: _["id"] == inst_id, self.inst)))

			for a_inst_id in inst_dep_list_bind:
				for b_inst_id in inst_dep_list_bind:
					if idx_db[a_inst_id] > idx_db[b_inst_id] and idx_db[a_inst_id] != idx_db[b_inst_id]:
						dep[a_inst_id].append(b_inst_id)

		for inst_id in self.inst:
			if inst_id["id"] not in dep:
				dep[inst_id["id"]] = []

		return {
			"idx": list(map(lambda _: _[0], lib0246.flat_iter(lib0246.toposort(dep, key_func=lambda _: next(i for i, c in enumerate(self.inst) if c["id"] == _)), layer=1))),
			"dep": dep
		}

	def __str__(self):
		return f"CloudData({self.inst}, {self.group}, {self.db})"
	
	def __repr__(self):
		return f"CloudData({json.dumps(self.inst, indent=2)}, {json.dumps(self.group, indent=2)}, {json.dumps(self.db, indent=2)})"

########################################################################################
######################################## HIJACK ########################################
########################################################################################

BASE_EXECUTOR = None

def init_executor_param_handle(*args, **kwargs):
	return None, tuple(), {}

def init_executor_res_handle(result, *args, **kwargs):
	global BASE_EXECUTOR
	if BASE_EXECUTOR is None:
		BASE_EXECUTOR = args[0]
	return result

lib0246.hijack(execution.PromptExecutor, "__init__", init_executor_param_handle, init_executor_res_handle)

PROMPT_COUNT = 0
PROMPT_DATA = None
PROMPT_ID = None
PROMPT_EXTRA = None

PROMPT_UPDATE = set()
PROMPT_IGNORE = set()
PROMPT_IGNORE_FLAG = False
PROMPT_NODE_ID = None

PROMPT_HIJACK = set()

def is_changed_res_handle(result, *args, **kwargs):
	global PROMPT_NODE_ID
	if PROMPT_NODE_ID in PROMPT_IGNORE:
		PROMPT_NODE_ID = None
		return False
	if PROMPT_NODE_ID in PROMPT_UPDATE:
		PROMPT_UPDATE.remove(PROMPT_NODE_ID)
		PROMPT_NODE_ID = None
		return float("NaN")
	return result

def execute_param_handle(*args, **kwargs):
	global PROMPT_ID
	global PROMPT_COUNT
	global PROMPT_DATA
	global PROMPT_EXTRA
	if PROMPT_ID is None or PROMPT_ID != args[2]:
		PROMPT_COUNT += 1
		PROMPT_DATA = args[1]
		PROMPT_ID = args[2]
		PROMPT_EXTRA = args[3]

	return None, tuple(), {}

def executor_res_handle(result, *args, **kwargs):
	global PROMPT_UPDATE
	global PROMPT_IGNORE
	global PROMPT_IGNORE_FLAG
	global PROMPT_HIJACK
	
	for node_id in PROMPT_UPDATE:
		if hasattr(BASE_EXECUTOR, "outputs") and node_id in BASE_EXECUTOR.outputs:
			del BASE_EXECUTOR.outputs[node_id]
		else:
			curr_class_type = args[1][node_id]["class_type"]
			if curr_class_type not in PROMPT_HIJACK:
				PROMPT_HIJACK.add(curr_class_type)
				curr_class = nodes.NODE_CLASS_MAPPINGS[curr_class_type]

				if hasattr(curr_class, "IS_CHANGED"):
					lib0246.hijack(curr_class, "IS_CHANGED", res_func=is_changed_res_handle)
				else:
					curr_class.IS_CHANGED = functools.partial(is_changed_res_handle, None)

	if hasattr(BASE_EXECUTOR, "outputs"):
		PROMPT_UPDATE.clear()
	PROMPT_IGNORE.clear()
	PROMPT_IGNORE_FLAG = False
	return result

lib0246.hijack(execution.PromptExecutor, "execute", execute_param_handle, executor_res_handle)

def get_input_data_param_handle(*args, **kwargs):
	global PROMPT_IGNORE
	global PROMPT_IGNORE_FLAG
	global PROMPT_NODE_ID
	PROMPT_NODE_ID = args[2]
	if args[2] in PROMPT_IGNORE:
		PROMPT_IGNORE_FLAG = True
	return None, tuple(), {}

lib0246.hijack(execution, "get_input_data", get_input_data_param_handle)

def map_node_over_list_func_handle(func, *args, **kwargs):
	return [[[None]]]

def map_node_over_list_param_handle(*args, **kwargs):
	global PROMPT_IGNORE_FLAG
	if PROMPT_IGNORE_FLAG:
		PROMPT_IGNORE_FLAG = False
		return map_node_over_list_func_handle, tuple(), {}
	return None, tuple(), {}

def map_node_over_list_res_handle(result, *args, **kwargs):
	if hasattr(args[0], "INPUT_IS_LIST") and args[0].INPUT_IS_LIST:
		try:
			wrap_obj = next(filter(lambda _: isinstance(_, lib0246.Wrapper), result))
			return [*map(lambda _: lib0246.Wrapper(_, wrap_obj._0246), result)]
		except StopIteration:
			return result
	
	for (curr, index_info), i in zip(lib0246.dict_slice(args[1]), range(len(result))):
		for key in curr:
			if isinstance(curr[key], lib0246.Wrapper):
				if isinstance(result[i], dict):
					result[i]["result"] = tuple(lib0246.Wrapper(_, curr[key]._0246) for _ in result[i]["result"])
				else:
					result[i] = tuple(lib0246.Wrapper(_, curr[key]._0246) for _ in result[i])
				break

	return result

lib0246.hijack(execution, "map_node_over_list", map_node_over_list_param_handle, map_node_over_list_res_handle)

CLASS_LIST = None

if not hasattr(execution, "recursive_execute") or \
	(hasattr(execution, "EXPERIMENTAL_EXECUTION") and execution.EXPERIMENTAL_EXECUTION):
	temp_info = None

	def get_input_info_func_handle(func, *args, **kwargs):
		temp_res = func(*args, **kwargs)
		if temp_res[2] is None:
			return (lib0246.TautologyStr("*"), "optional", temp_info)
		return temp_res

	def get_input_info_param_handle(*args, **kwargs):
		global CLASS_LIST
		global NODE_CLASS_MAPPINGS
		global temp_info
		if CLASS_LIST is None:
			CLASS_LIST = set(obj for name, obj in inspect.getmembers(sys.modules[__name__]) if inspect.isclass(obj))
		if args[0] == Loop:
			temp_info = {"rawLink": True}
			return get_input_info_func_handle, tuple(), {}
		elif args[0] == Switch:
			temp_info = {"lazy": True}
			return get_input_info_func_handle, tuple(), {}
		elif args[0] in CLASS_LIST:
			temp_info = {}
			return get_input_info_func_handle, tuple(), {}
		return None, tuple(), {}
	
	def get_input_info_res_handle(result, *args, **kwargs):
		return result

	lib0246.hijack(comfy_graph, "get_input_info", get_input_info_param_handle, get_input_info_res_handle)
	lib0246.hijack(execution, "get_input_info", get_input_info_param_handle, get_input_info_res_handle)

#####################################################################################
######################################## API ########################################
#####################################################################################

@server.PromptServer.instance.routes.post('/0246-parse-highway')
async def parse_highway_handler(request):
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

@server.PromptServer.instance.routes.post('/0246-parse-prompt')
async def parse_prompt_handler(request):
	data = await request.json()

	# Validate json
	if data.get("prompt") is None:
		return aiohttp.web.json_response({
			"error": ["No prompt provided"]
		})
	
	return aiohttp.web.json_response({
		"res": CloudData.text_to_dict(data["prompt"])
	})

@server.PromptServer.instance.routes.post('/0246-clear')
async def clear_handler(request):
	global BASE_EXECUTOR
	if hasattr(BASE_EXECUTOR, "outputs"):
		BASE_EXECUTOR.outputs.clear()
		BASE_EXECUTOR.outputs_ui.clear()
		BASE_EXECUTOR.object_storage.clear()
	BASE_EXECUTOR.server.last_prompt_id = None
	RandomInt.RANDOM_DB.clear()
	Hold.HOLD_DB.clear()
	Loop.LOOP_DB.clear()
	
	return aiohttp.web.json_response({})

@server.PromptServer.instance.routes.post('/0246-terminate')
async def terminate_handler(request):
	# This requires modifying source code of ComfyUI, which is required
	# For personal purpose only
	setattr(server.PromptServer.instance, "terminate", True)
	
	return aiohttp.web.json_response({})

######################################################################################
######################################## NODE ########################################
######################################################################################

class Highway:
	@classmethod
	def INPUT_TYPES(cls):
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
	def IS_CHANGED(cls, *args, **kwargs):
		return lib0246.check_update(kwargs["_query"])

######################################################################################

class HighwayBatch:
	@classmethod
	def INPUT_TYPES(cls):
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
	def IS_CHANGED(cls, *args, **kwargs):
		return lib0246.check_update(kwargs["_query"])

######################################################################################

class Junction:
	@classmethod
	def INPUT_TYPES(cls):
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
	def IS_CHANGED(cls, *args, **kwargs):
		return lib0246.check_update(kwargs["_offset"])

######################################################################################

class JunctionBatch:
	@classmethod
	def INPUT_TYPES(cls):
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
	def IS_CHANGED(cls, *args, **kwargs):
		return lib0246.check_update(kwargs["_offset"])

######################################################################################

class Count:
	@classmethod
	def INPUT_TYPES(cls):
		return {
			"required": {
				"_node": (lib0246.TautologyStr("*"), ),
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
		if isinstance(_id, list):
			_id = str(_id[0]) if len(_id) > 0 else None
		if isinstance(_id, str):
			_id = _id[_id.rfind(".") + 1:]
		if Count.COUNT_ID != PROMPT_ID:
			Count.COUNT_DB = {}
			Count.COUNT_ID = PROMPT_ID
		if _id not in Count.COUNT_DB:
			Count.COUNT_DB[_id] = 0
		temp = Count.COUNT_DB[_id]
		Count.COUNT_DB[_id] += 1

		return {
			"ui": {
				"text": [f"Count: {temp}, Track: {Count.COUNT_ID}"]
			},
			"result": (temp, {
				"id": _id,
				"bool": temp >= int(_event[0]),
			})
		}

######################################################################################

class RandomInt:
	@classmethod
	def INPUT_TYPES(cls):
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
		if isinstance(_id, list):
			_id = str(_id[0]) if len(_id) > 0 else None
		if isinstance(_id, str):
			_id = _id[_id.rfind(".") + 1:]
		
		if _id not in RandomInt.RANDOM_DB:
			RandomInt.RANDOM_DB[_id] = {
				"track": None,
				"prev": [],
				"prev_batch_size": 0,
				"inst": random.Random(),
				"seed": seed[0],
				"flag": 0
			}

		db = RandomInt.RANDOM_DB[_id]

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
	def IS_CHANGED(cls, val = None, *args, **kwargs):
		if ("rand", "sub", "add") in map(lambda _: _.strip(), val[0].split(",")):
			return float("NaN")
		return val[0]

######################################################################################

class Hold:
	@classmethod
	def INPUT_TYPES(cls):
		return {
			"required": {
				"_mode": (["save", "clear", "pin"], ),
				"_key_id": ("STRING", {
					"default": "",
					"multiline": False
				}),
			},
			"optional": {
				"_data_in": (lib0246.TautologyStr("*"), ),
				"_hold": ("HOLD_TYPE", )
			},
			"hidden": {
				"_id": "UNIQUE_ID",
				"_prompt": "PROMPT",
				"_workflow": "EXTRA_PNGINFO"
			}
		}
	
	HOLD_DB = {}
	
	RETURN_TYPES = lib0246.ByPassTypeTuple(("*", "*"))
	RETURN_NAMES = ("_data_out", "_data_out_all")
	INPUT_IS_LIST = True
	OUTPUT_IS_LIST = (True, True)
	NOT_IDEMPOTENT = True # Since this node is similar to CheckpointLoaderSimple (to save resources)
	FUNCTION = "execute"
	CATEGORY = "0246"

	def execute(self, _data_in = None, _id = None, _prompt = None, _workflow = None, _hold = None, _mode = None, _key_id = None, **kwargs):
		for key in kwargs:
			if key.startswith("_data_in"):
				_data_in = kwargs[key]
				break
		if isinstance(_id, list):
			_id = str(_id[0]) if len(_id) > 0 else None
		if isinstance(_id, str):
			_id = _id[_id.rfind(".") + 1:]
		if isinstance(_prompt, list):
			_prompt = _prompt[0] if len(_prompt) > 0 else None
		if isinstance(_workflow, list):
			_workflow = _workflow[0] if len(_workflow) > 0 else None
		if isinstance(_hold, list):
			_hold = _hold[0] if len(_hold) > 0 else None
		if isinstance(_mode, list):
			_mode = _mode[0] if len(_mode) > 0 else None
		if isinstance(_key_id, list):
			_key_id = str(_key_id[0]) if len(_key_id) > 0 else None

		param_flag = _key_id is not None and len(_key_id) > 0

		if _id not in Hold.HOLD_DB:
			Hold.HOLD_DB[_id] = {}
		if param_flag and _key_id not in Hold.HOLD_DB:
			Hold.HOLD_DB[_key_id] = {}

		ui_text = f"Id: {_id}, "
		result = None

		param_flag = _key_id is not None and len(_key_id) > 0

		if _hold:
			if (
				_mode == "clear" or
				Hold.HOLD_DB[_id].get("mode", "") != _mode or
				"data" not in Hold.HOLD_DB[_id] or
				Hold.HOLD_DB[_id].get("track", "") != PROMPT_ID
			):
				Hold.HOLD_DB[_id]["data"] = []
				Hold.HOLD_DB[_id]["mode"] = _mode
				Hold.HOLD_DB[_id]["track"] = PROMPT_ID
				
			match Hold.HOLD_DB[_key_id]["mode"]:
				case "save":
					for curr in Hold.HOLD_DB[Hold.HOLD_DB[_key_id]["id"]]["data"]:
						Hold.HOLD_DB[_id]["data"].extend(curr)
				# case "pin" if _mode == "pin":
				# 	Hold.HOLD_DB[_key_id]["data"].clear()
				case _:
					Hold.HOLD_DB[_id]["data"].extend(_data_in)

			result = [Hold.HOLD_DB[_id]["data"], [None]]

			ui_text += f"Passed, Size: {len(result[0])}, "
		elif param_flag:
			mode_flag = _key_id in Hold.HOLD_DB and "mode" in Hold.HOLD_DB[_key_id]

			if (
				mode_flag and \
				Hold.HOLD_DB[_key_id]["mode"] == "pin" and \
				_key_id in _prompt and _prompt[_key_id]["inputs"]["_mode"] == "pin"
			):
				result = [[None]] if _data_in is None or len(_data_in) == 0 else _data_in
			elif (
				mode_flag and \
				Hold.HOLD_DB[_key_id]["mode"] == "save" and \
				_key_id in _prompt and _prompt[_key_id]["inputs"]["_mode"] == "save"
			) or (
				Hold.HOLD_DB[_id].get("track", "") == PROMPT_ID
			):
				result = [Hold.HOLD_DB[_key_id]["data"][-1]]
			elif _data_in is not None and len(_data_in) > 0:
				result = [_data_in]
			else:
				result = [[None]]

			Hold.HOLD_DB[_id]["id"] = _key_id
			if Hold.HOLD_DB[_id].get("mode", "") != _mode or Hold.HOLD_DB[_id].get("track", "") != PROMPT_ID:
				Hold.HOLD_DB[_id]["track"] = PROMPT_ID
				Hold.HOLD_DB[_id]["data"] = []
				Hold.HOLD_DB[_id]["mode"] = _mode

			if "data" in Hold.HOLD_DB[_key_id] and len(Hold.HOLD_DB[_key_id]["data"][0]) > 0 and _mode == "pin":
				result.append(Hold.HOLD_DB[_key_id]["data"][0])
			else:
				result.append([None])

			ui_text += f"Key: {_key_id}, Size: {len(result[0])}, "
		else:
			if Hold.HOLD_DB[_id].get("mode", "") != _mode or Hold.HOLD_DB[_id].get("track", "") != PROMPT_ID:
				Hold.HOLD_DB[_id]["track"] = PROMPT_ID
				Hold.HOLD_DB[_id]["data"] = []
				Hold.HOLD_DB[_id]["mode"] = _mode

			Hold.HOLD_DB[_id]["data"].append(_data_in)
			result = [_data_in, [None]]

			# [TODO] Support "pin" which is to store data across different prompt
				# To nuke data implement right cick action then call API
			# if _mode == "pin":
			# 	result.append(Hold.HOLD_DB[_id]["data"])

			ui_text += f"Size: {len(result[0])}, "

		ui_text += f"Track: {Hold.HOLD_DB[_id]['track']}"

		if hasattr(BASE_EXECUTOR, "caches"):
			BASE_EXECUTOR.caches.outputs.set(_id, result)

		return {
			"ui": {
				"text": [ui_text]
			},
			"result": result
		}
	
	@classmethod
	def IS_CHANGED(cls, *args, **kwargs):
		return float("NaN")

######################################################################################

class Loop:
	@classmethod
	def INPUT_TYPES(cls):
		return {
			"required": {
				"_event": (EventBoolStr("*"), ),
				"_mode": (["sweep"], ), # Reserved
				"_update": ("STRING", {
					"default": "{'update': ''}",
					"multiline": False
				}),
			},
			"hidden": {
				"_prompt": "PROMPT",
				"_id": "UNIQUE_ID",
				"_workflow": "EXTRA_PNGINFO",
				"_dynprompt": "DYNPROMPT",
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
		result = {
			"result": (True, )
		}

		if (isinstance(_event[0], dict) and not _event[0]["bool"]) or (isinstance(_event[0], bool) and not _event[0]):
			if hasattr(execution, "recursive_execute"):
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
							"exec": trace_node(_prompt[0], _id[0], _workflow[0], _input = True) # , lambda curr_id: exec.append(curr_id) if curr_id not in exec else None)
						}
						while Loop.LOOP_DB[(PROMPT_ID, _id[0])]["count"] > 0:
							Loop.LOOP_DB[(PROMPT_ID, _id[0])]["count"] -= 1
							for curr_id in Loop.LOOP_DB[(PROMPT_ID, _id[0])]["exec"]:
								if curr_id in BASE_EXECUTOR.outputs:
									del BASE_EXECUTOR.outputs[curr_id]
							success, error, ex = execution.recursive_execute(server.PromptServer.instance, _prompt[0], BASE_EXECUTOR.outputs, _id[0], {"extra_pnginfo": _workflow[0]}, set(), PROMPT_ID, BASE_EXECUTOR.outputs_ui, BASE_EXECUTOR.object_storage)
							if success is not True:
								raise ex
						del Loop.LOOP_DB[(PROMPT_ID, _id[0])]
			else:
				dynprompt = kwargs["_dynprompt"][0]
				del kwargs["_dynprompt"]
				adj_id = []
				contained = {}
				upstream = {}
				trace_node_back(_id[0], dynprompt, upstream)
				if isinstance(_event[0], dict):
					kwargs["_event"] = [[_event[0]["id"]]]
				for curr_key in kwargs:
					node_id = kwargs[curr_key][0][0]
					adj_id.append(node_id)
					trace_node_front(node_id, upstream, contained)
					contained[_id[0]] = True
					contained[node_id] = True
				graph = comfy_graph_utils.GraphBuilder()
				for node_id in contained:
					graph.node(
						dynprompt.get_node(node_id)["class_type"],
						"_" if node_id == _id[0] else node_id
					).set_override_display_id(node_id)
				for node_id in contained:
					node = graph.lookup_node("_" if node_id == _id[0] else node_id)
					for k, v in dynprompt.get_node(node_id)["inputs"].items():
						if comfy_graph_utils.is_link(v) and v[0] in contained:
							parent = graph.lookup_node(v[0])
							node.set_input(k, parent.out(v[1]))
						else:
							node.set_input(k, v)

				result["result"] = [graph.lookup_node("_").out(0)]
				result["expand"] = graph.finalize()

		return result

	@classmethod
	def IS_CHANGED(cls, *args, **kwargs):
		return lib0246.check_update(kwargs["_update"])

######################################################################################

class Merge:
	@classmethod
	def INPUT_TYPES(cls):
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
	def INPUT_TYPES(cls):
		return {
			"optional": {
				"data": (lib0246.TautologyStr("*"), ),
			},
			"required": {
				"mode": (["basic", "more", "full", "json"], ),
			},
		}
	
	RETURN_TYPES = ()
	INPUT_IS_LIST = True
	OUTPUT_NODE = True
	FUNCTION = "execute"
	CATEGORY = "0246"

	def execute(self, data = None, mode = None, **kwargs):
		for key in kwargs:
			if key.startswith("data"):
				data = kwargs[key]
				break

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
	def INPUT_TYPES(cls):
		return {
			"required": {
				"_mode": (["basic", "value", "force"],),
				"_delimiter": ("STRING", {
					"default": ", ",
					"multiline": False
				}),
			},
			"hidden": {
				"_id": "UNIQUE_ID",
				"_prompt": "PROMPT",
				"_workflow": "EXTRA_PNGINFO"
			}
		}
	
	RETURN_TYPES = ("STRING", )
	RETURN_NAMES = ("_str", )
	INPUT_IS_LIST = True
	FUNCTION = "execute"
	CATEGORY = "0246"

	def execute(self, _delimiter = None, _mode = None, _id = None, _prompt = None, _workflow = None, **kwargs):
		res = []

		for value in kwargs.values():
			if isinstance(value, list):
				for item in value:
					if isinstance(item, CloudData) and (_mode[0] == "basic" or _mode[0] == "value"):
						item = _delimiter[0].join(map(str, item.data_eval(_id[0], _prompt[0], _workflow[0])))
					elif _mode[0] == "basic" and type(item).__str__ is object.__str__:
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
	def INPUT_TYPES(cls):
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
				"box_range": ("BOX_RANGE", {
					"ratio": {
						"data": {
							"width": 512,
							"height": 512,
						},
					},
					"row_count": 10,
					"col_count": 10,
					"flex": {
						"share": 1,
						"min_h": 50,
						"center": True,
					}
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
		cls, build_fn, box_range, box_range_ratio, #res_dict = None, res_list = None,
		_W = False, _H = False, _S8W = False, _S8H = False, _R = False, _A = False,
		_x = False, _y = False, _w = False, _h = False,
		_px = False, _py = False, _pw = False, _ph = False,
		# _rx = False, _ry = False,
		_s8x = False, _s8y = False, _s8w = False, _s8h = False,
	):
		if _W:
			build_fn(box_range_ratio["data"]["width"], "W")
		if _H:
			build_fn(box_range_ratio["data"]["height"], "H")
		if _S8W:
			build_fn(lib0246.snap(box_range_ratio["data"]["width"], 8), "S8W")
		if _S8H:
			build_fn(lib0246.snap(box_range_ratio["data"]["height"], 8), "S8H")
		if _R:
			build_fn(box_range_ratio["data"]["ratio"], "R")
		if _A:
			build_fn(box_range_ratio["data"]["width"] * box_range_ratio["data"]["height"], "A")

		for i in range(len(box_range["data"])):
			if _x:
				build_fn(lib0246.map(
					box_range["data"][i][0],
					box_range["area"][0], box_range["area"][0] + box_range["area"][2],
					0, box_range_ratio["data"]["width"]
				), "x")
			if _y:
				build_fn(lib0246.map(
					box_range["data"][i][1],
					box_range["area"][1], box_range["area"][1] + box_range["area"][3],
					0, box_range_ratio["data"]["height"]
				), "y")
			if _w:
				build_fn(lib0246.map(
					box_range["data"][i][2],
					0, box_range["area"][2],
					0, box_range_ratio["data"]["width"]
				), "w")
			if _h:
				build_fn(lib0246.map(
					box_range["data"][i][3],
					0, box_range["area"][3],
					0, box_range_ratio["data"]["height"]
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
					0, box_range_ratio["data"]["width"]
				), 8), "s8x")
			if _s8y:
				build_fn(lib0246.snap(lib0246.map(
					box_range["data"][i][1],
					box_range["area"][1], box_range["area"][1] + box_range["area"][3],
					0, box_range_ratio["data"]["height"]
				), 8), "s8y")
			if _s8w:
				build_fn(lib0246.snap(lib0246.map(
					box_range["data"][i][2],
					0, box_range["area"][2],
					0, box_range_ratio["data"]["width"]
				), 8), "s8w")
			if _s8h:
				build_fn(lib0246.snap(lib0246.map(
					box_range["data"][i][3],
					0, box_range["area"][3],
					0, box_range_ratio["data"]["height"]
				), 8), "s8h")

	@classmethod
	def process_box_batch(cls, batch, data, name):
		curr_index = BoxRange.FUNC_KEY_LIST.index(name)
		if curr_index >= 0:
			batch[curr_index].append(data)

	def execute(self, _id = None, script_box_regex = None, script_order = None, box_range = None, box_range_ratio = None):
		if isinstance(script_box_regex, list):
			script_box_regex = script_box_regex[0]
		if isinstance(script_order, list):
			script_order = script_order[0]
		if isinstance(box_range, list):
			box_range = box_range[0]
		if isinstance(box_range_ratio, list):
			box_range_ratio = box_range_ratio[0]

		full_res = [None]

		script_regex = BoxRange.FUNC_REGEX(script_box_regex)

		batch_res = []
		for i in range(len(BoxRange.FUNC_KEY_LIST)):
			batch_res.append([])

		BoxRange.process_box(
			lambda _, name: BoxRange.process_box_batch(batch_res, _, name),
			box_range, box_range_ratio,
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
						box_range, box_range_ratio,
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
				"dim": box_range_ratio
			}

		BoxRange.process_box(
			lambda _, name: full_res.append([_]),
			box_range, box_range_ratio,
			**{("_" + key): script_regex.match("%" + key) is not None for key in BoxRange.FUNC_KEY_LIST}
		)

		return full_res
	
	@classmethod
	def IS_CHANGED(cls, *args, **kwargs):
		return kwargs["box_range"][0] if isinstance(kwargs["box_range"], list) else kwargs["box_range"]

######################################################################################

class ScriptNode:
	@classmethod
	def INPUT_TYPES(cls):
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
				"pipe_in": (lib0246.TautologyStr("*"), ),
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
				pin_func = highway_unpack(pipe_in)
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

		node_args = set()
		node_args_base = set()
		node_args_hide = set()
		node_args_hide_full = set()
		for tuple_path in lib0246.dict_iter(input_type):
			node_args.add(tuple_path[1])
			if tuple_path[0] == "hidden":
				node_args_hide.add(tuple_path[1])
				temp_type = lib0246.dict_get(input_type, tuple_path)
				if isinstance(temp_type, tuple):
					temp_type = temp_type[0]
				node_args_hide_full.add((tuple_path[1], temp_type))
			else:
				node_args_base.add(tuple_path[1])

		return (
			pipe_in,
			None if pin_func is None else ScriptData({
				"id": _id,
				"func": pin_func,
				"order": script_pin_order,
				"kind": "wrap"
			}), ScriptData({
				"id": _id,
				"func": functools.partial(
					script_node_exec,
					node_inst=class_type(),
					node_name=script_node,
					node_class=class_type,
					node_input=input_type,
					node_args=node_args,
					node_args_base=node_args_base,
					node_args_hide=node_args_hide,
					node_args_hide_full=node_args_hide_full,
				),
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
	def INPUT_TYPES(cls):
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
			curr_match_pin = script_rule_regex.match("@" + curr_pin)
			if curr_match_pin:
				for (i, curr_out), curr_type in zip(enumerate(script_name), script_type):
					curr_match_out = script_rule_regex.match("%" + curr_out)
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
		pin.update(next(pipe_iter)[0])

		while True:
			flag = 0

			temp_res = func(pin=pin) if \
				curr_func is None else (
					list(func(pin=curr_raw_pin[0]) \
						for curr_raw_pin in curr_func(pin))
				)

			curr_count += 1

			try:
				pin.update(next(pipe_iter)[0])
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
			node_data = script[("script", "exec")]()
			pile_data = ScriptPile.build_pile(
				tuple(
					getattr(node_data[0], "RETURN_NAMES") if \
					hasattr(node_data[0], "RETURN_NAMES") else \
					getattr(node_data[0], "RETURN_TYPES")
				),
				tuple(getattr(node_data[0], "RETURN_TYPES")),
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
					pin_key_set = set(pin.keys())
					diff_key_set = (pin_key_set - node_data[5]) | (node_data[5] - pin_key_set)

					if len(diff_key_set) == 0:
						raise Exception("No input and output to pile up.")

					input_type = {}
					for input_key in lib0246.dict_iter(node_data[3]):
						if input_key[1] in diff_key_set:
							lib0246.dict_set(input_type, input_key, lib0246.dict_get(node_data[3], input_key))

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
	def INPUT_TYPES(cls):
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
	def INPUT_TYPES(cls):
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
	def INPUT_TYPES(cls):
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
		self_index = None
		for i, _ in enumerate(curr_nodes):
			if _["id"] == int(_id[0]):
				self_index = i
				break
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

class Cloud:
	@classmethod
	def INPUT_TYPES(cls):
		return {
			"required": lib0246.WildDict(),
			"optional": {
				"cloud": ("CLOUD_DATA", )
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

	def execute(self, _id = None, _prompt = None, _workflow = None, **kwargs):
		res = CloudData()
		curr_cloud = copy.deepcopy(kwargs["cloud:cloud"][0])
		res.dict_to_data(_id[0], curr_cloud["inst"], curr_cloud["group"], None, kwargs)
		return {
			"ui": {
				"text": [""]
			},
			"result": [[res]]
		}

######################################################################################

class Switch:
	@classmethod
	def INPUT_TYPES(cls):
		return {
			"required": lib0246.WildDict(),
			"hidden": {
				"_id": "UNIQUE_ID",
				"_prompt": "PROMPT",
				"_workflow": "EXTRA_PNGINFO"
			}
		}
	
	RETURN_TYPES = lib0246.TautologyDictStr()
	INPUT_IS_LIST = True
	OUTPUT_IS_LIST = lib0246.TautologyAll()
	FUNCTION = "execute"
	CATEGORY = "0246"

	SWITCH_TRACK = None
	SWITCH_PROMPT = None

	def check_lazy_status(self, _id = None, _prompt = None, _workflow = None, **kwargs):
		res = []
		for key in kwargs:
			key_data = key.split(":")
			if key_data[0] == "switch":
				temp_index = kwargs[key][0].split(":")[0]
				if temp_index != "_":
					res.append(kwargs[key][0])
		return res

	def execute(self, _id = None, _prompt = None, _workflow = None, **kwargs):
		if isinstance(_id, list):
			_id = _id[0]
		if isinstance(_prompt, list):
			_prompt = _prompt[0]
		if isinstance(_workflow, list):
			_workflow = _workflow[0]

		# [TODO] Remember to recheck "switch:..." (optionally calling recursive_output_delete_if_changed)

		output = _workflow["workflow"]["nodes"][
			next(i for i, _ in enumerate(_workflow["workflow"]["nodes"]) if _["id"] == int(_id))
		]["outputs"]
		res = []
		for key in kwargs:
			key_data = key.split(":")
			if key_data[0] == "switch":
				temp_index = kwargs[key][0].split(":")[0]
				if temp_index == "_":
					res.append([None])

					output_node_list = []
					for output_link in output[int(key_data[-1])]["links"]:
						output_node_list.append(next(_ for _ in _workflow["workflow"]["links"] if _[0] == output_link)[3])

					global PROMPT_IGNORE
					for curr_output in output_node_list:
						PROMPT_IGNORE.update(trace_node(
							_prompt, str(curr_output), _workflow, _input = False,
							_func = lambda id_stk, node_id: \
								trace_node_func(id_stk, node_id) if _prompt[str(node_id)]["class_type"] != "0246.Switch" else None
						))
					continue
				for pin in output:
					if pin["name"].split(":")[-1] == key_data[-1]:
						res.append(kwargs[kwargs[key][0]])
						break
		return res

	@classmethod
	def IS_CHANGED(cls, _id = None, *args, **kwargs):
		global PROMPT_DATA
		global PROMPT_ID
		if Switch.SWITCH_TRACK is None or Switch.SWITCH_TRACK != PROMPT_ID:
			Switch.SWITCH_TRACK = PROMPT_ID
			Switch.SWITCH_PROMPT = copy.deepcopy(PROMPT_DATA)

		valid_input = set()
		for key in kwargs:
			if key.startswith("switch:"):
				temp_index = kwargs[key][0].split(":")[0]
				if temp_index != "_":
					valid_input.add(temp_index)

		if hasattr(execution, "recursive_execute"):
			for key in Switch.SWITCH_PROMPT[_id[0]]["inputs"]:
				curr_index = key.split(":")[0]
				if curr_index.isnumeric():
					if curr_index in valid_input:
						PROMPT_DATA[_id[0]]["inputs"][key] = Switch.SWITCH_PROMPT[_id[0]]["inputs"][key]
					else:
						del PROMPT_DATA[_id[0]]["inputs"][key]
		return " ".join(kwargs.keys())

######################################################################################

class Meta:
	@classmethod
	def INPUT_TYPES(cls):
		return {
			"required": lib0246.WildDict(),
			"optional": {
				"data": (lib0246.TautologyStr("*"), ),
			},
			"hidden": {
				"_prompt": "PROMPT",
				"_id": "UNIQUE_ID",
				"_workflow": "EXTRA_PNGINFO"
			}
		}
	
	RETURN_TYPES = ("INT", "INT", "STRING", "STRING", "STRING", "STRING")
	RETURN_NAMES = ("batch_size", "data_size", "key_list", "type_list", "comfy_type", "py_type")
	INPUT_IS_LIST = True
	OUTPUT_IS_LIST = lib0246.TautologyAll()
	FUNCTION = "execute"
	CATEGORY = "0246"

	def execute(self, _id = None, _prompt = None, _workflow = None, data = None, **kwargs):
		for key in kwargs:
			if key.startswith("data"):
				data = kwargs[key]
				break

		if isinstance(_id, list):
			_id = _id[0]
		if isinstance(_prompt, list):
			_prompt = _prompt[0]
		if isinstance(_workflow, list):
			_workflow = _workflow[0]

		data_size = []
		key_list = []
		type_list = []
		input_type = None
		if len(data) > 0:
			match data[0]:
				case lib0246.RevisionDict() if data[0]["kind"] == "highway" or data[0]["kind"] == "junction":
					data_size.append(data[0].path_count(("data", )))
					key_list.extend(map(lambda _:  _[1], data[0].path_iter(("data", ))))
					type_list.extend(map(lambda _: data[0][("type", _)], key_list))
					if data[0]["kind"] == "highway":
						for key in key_list:
							data_size.append(len(data[0][("data", key)]) if isinstance(data[0][("data", key)], lib0246.RevisionBatch) else 1)
					else:
						unique_key = []
						for key in key_list:
							if key not in unique_key:
								unique_key.append(key)
						for key in unique_key:
							data_size.append(data[0].path_count(("data", key)))
				case lib0246.RevisionDict() if data[0]["kind"] == "script":
					data_size.append(data[0].path_count(("script", "data")))
					key_list.extend(map(lambda _:  _[2], data[0].path_iter(("script", "data"))))
					type_list.extend(map(lambda _: type(data[0][("script", "data", _)]).__name__, key_list))
				case CloudData():
					data_size.append(len(data[0].inst))
					key_list.extend(map(lambda _: _["id"], data[0].inst))
					type_list.extend(map(lambda _: _["kind"], data[0].inst))
				case str():
					char_list = regex.findall(r'\X', data[0])
					data_size.append(len(char_list))
					data_size.append(len(data[0]))
					key_list.extend(char_list) # Grapheme cluster
					key_list.append("") # Sentinel using empty string
					key_list.extend(data[0]) # Code point
					type_list.extend(map(lambda _: unicodedata.category(_), data[0]))
				case int():
					data_size.append(sys.getsizeof(data[0]))
					key_list.extend(bin(data[0])[2:])
				case float():
					data_size.append(sys.getsizeof(data[0]))
					key_list.extend(bin(struct.unpack('Q', struct.pack('d', data[0]))[0])[2:])

			input_node_link = _workflow["workflow"]["nodes"][
				next(i for i, _ in enumerate(_workflow["workflow"]["nodes"]) if _["id"] == int(_id))
			]["inputs"][0]["link"]
			input_node_link_data = next(_ for _ in _workflow["workflow"]["links"] if _[0] == input_node_link)
			input_type = _workflow["workflow"]["nodes"][
				next(i for i, _ in enumerate(_workflow["workflow"]["nodes"]) if _["id"] == input_node_link_data[1])
			]["outputs"][input_node_link_data[2]]["type"]

			# [OBSOLETE] The problem with this is this only able to scan outputs, not inputs
			# if input_node["type"] in nodes.NODE_CLASS_MAPPINGS:
			# 	class_input_type = nodes.NODE_CLASS_MAPPINGS[input_node["type"]].INPUT_TYPES()
			# 	for key in lib0246.dict_iter(class_input_type):
			# 		if input_node["outputs"][input_node_link_data[2]]["name"] == key[-1]:
			# 			type_data = lib0246.dict_get(class_input_type, key)
			# 			if isinstance(type_data[0], list):
			# 				data_size.extend(len(type_data[0]))
			# 				break

		return (
			[len(data)],
			data_size,
			key_list,
			type_list,
			[input_type],
			[type(data[0]).__name__]
		)

######################################################################################

class Tag:
	@classmethod
	def INPUT_TYPES(cls):
		return {
			"required": {
				"data_in": (lib0246.TautologyStr("*"), ),
				"ops_mode": (["apply", "check", "remove", "clear"], ),
				"neg_mode": ("BOOLEAN", ),
				"tag_mode": (["exact", "regex"], ),
				"tag": ("STRING", {
					"default": "tag",
					"multiline": True
				}),
			},
			"hidden": {
				"_prompt": "PROMPT",
				"_id": "UNIQUE_ID",
				"_workflow": "EXTRA_PNGINFO"
			}
		}
	
	INPUT_IS_LIST = True
	OUTPUT_IS_LIST = (True, )
	RETURN_TYPES = (lib0246.TautologyStr("*"), )
	RETURN_NAMES = ("data_out", )
	FUNCTION = "execute"
	CATEGORY = "0246"

	def execute(
		self, _id = None, _prompt = None, _workflow = None,
		data_in = None, ops_mode = None, neg_mode = None, tag = None, tag_mode = None,
		**kwargs
	):
		if isinstance(_id, list):
			_id = _id[0]
		if isinstance(_prompt, list):
			_prompt = _prompt[0]
		if isinstance(_workflow, list):
			_workflow = _workflow[0]

		if isinstance(ops_mode, list):
			ops_mode = ops_mode[0]
		if isinstance(neg_mode, list):
			neg_mode = neg_mode[0]
		if isinstance(tag, list):
			tag = tag[0]
		if isinstance(tag_mode, list):
			tag_mode = tag_mode[0]

		if ops_mode == "apply":
			res = []
			for curr in data_in:
				if isinstance(curr, lib0246.Wrapper):
					curr_attr = getattr(curr, "_0246")
					try:
						curr_attr["id"][curr_attr["tag"].index(tag)] = _id
					except ValueError:
						curr_attr = {
							"tag": curr_attr["tag"] + [tag],
							"id": curr_attr["id"] + [_id]
						}
					res.append(lib0246.Wrapper(curr.__wrapped__, curr_attr))
				else:
					res.append(lib0246.Wrapper(curr, {
						"tag": [tag],
						"id": [_id]
					}))
			return (res, )

		res = []
		hold = []
		for curr in data_in:
			if isinstance(curr, lib0246.Wrapper):
				curr_attr = getattr(curr, "_0246")
				curr_index = -1
				if tag_mode == "exact":
					try:
						curr_index = curr_attr["tag"].index(tag)
					except ValueError:
						pass
				else:
					for i, curr_tag in enumerate(curr_attr["tag"]):
						if regex.search(tag, curr_tag):
							curr_index = i
							break
				if curr_index > -1: # Intentional double ifs
					if ops_mode == "remove":
						if len(curr_attr["tag"]) - 1 == 0:
							res.append(curr.__wrapped__)
							hold.append(curr)
							continue
						res.append(lib0246.Wrapper(curr.__wrapped__, {
							"tag": curr_attr["tag"][:curr_index] + curr_attr["tag"][curr_index + 1:],
							"id": curr_attr["id"][:curr_index] + curr_attr["id"][curr_index + 1:]
						}))
						continue
					elif ops_mode == "clear":
						res.append(curr.__wrapped__)
						hold.append(curr)
						continue
					res.append(curr)

		if neg_mode:
			return ([
				_.__wrapped__ if
				ops_mode == "clear" and isinstance(_, lib0246.Wrapper) else
				_ for _ in data_in if _ not in hold and _ not in res
			], )
		return (res, )

########################################################################################
######################################## EXPORT ########################################
########################################################################################

# [TODO] "RandomInt" node can have linger seed if batch len is different
# [TODO] NestedNodeBuilder prematurely replace prompt (./ComfyUI_NestedNodeBuilder/nodeMenu.js:45)
# [TODO] Another node pack that are spescialized on optimizing simple-purpose nodes (see work.md)
# [TODO] Cloud node when connected to Script, the Script node will detect is Cloud is allowed to be
	# converted (by having a cloud object "cloud" exist)
# [TODO] New cloud object for Cloud node
	# dupe: give data to "dupe" cloud object current position using data from same group
	# flip: enable or disable specific cloud
# [TODO] CastReroute keep disconnecting when loading workflow
# [TODO] Hub node cannot be copy-pasted between each tabs
# [TODO] Beautify input pin name got stuck if connected to CastReroute

NODE_CLASS_MAPPINGS.update({
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
	"0246.Cloud": Cloud,
	"0246.Switch": Switch,
	"0246.Meta": Meta,
	# "0246.Pick": Pick,
	"0246.Tag": Tag,
})

NODE_DISPLAY_NAME_MAPPINGS.update({
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
	"0246.Cloud": "Cloud",
	"0246.Switch": "Switch",
	"0246.Meta": "Meta",
	# "0246.Pick": "Pick",
	"0246.Tag": "Tag",
})

print("\033[95m" + lib0246.HEAD_LOG + "Loaded all nodes and apis." + "\033[0m")