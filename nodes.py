# import uuid
# import re
# import pathlib
# import sys

import bisect
import collections
import collections.abc

import aiohttp.web

from server import PromptServer

# Some python fucky wucky

class TautologyStr(str):
	def __ne__(self, other):
		return False

class ByPassTypeTuple(tuple):
	def __getitem__(self, index):
		if index > 0:
			index = 0
		item = super().__getitem__(index)
		if isinstance(item, str):
			return TautologyStr(item)
		return item

class RevisionItem(collections.namedtuple("RevisionItem", "key value his")):
	def __lt__(self, other):
		return self.his < other.his

class RevisionDict(collections.abc.MutableMapping):
	def __init__(self, *args, **kwargs):
		self._items = list()
		self._index = dict()
		self.update(*args, **kwargs)

	def __setitem__(self, key, value):
		self._index[key] = len(self._items)
		self._items.append(RevisionItem(key, value, self._index[key]))

	def __getitem__(self, key):
		return self._items[self._index[key]].value
	
	def __delitem__(self, key):
		index = self._index.pop(key)
		self._items.pop(index)
		self._index.update(
			((k, i - 1) for (k, i) in self._index.items() if i > index)
		)

	def __iter__(self):
		return iter(sorted(self._index, key=self._index.get))

	def __len__(self):
		return len(self._items)
	
	def find(self, key, his = None, func = None):
		# Move back from the insertion point until we find the key we are looking for
		index = bisect.bisect_right(self._items, RevisionItem(key, None, his)) - 1
		while index >= 0 and self._items[index].key != key:
			index -= 1

		# If we found an item with the matching key
		if index >= 0:
			if func is None:
				return self._items[index]
			return func(self._items[index], index)
		
		return None
	
	def recv(self, his = None):
		if his is None or his > len(self._items) - 2:
			his = len(self._items) - 1

		snapshot = {}

		for key in self._index.keys():
			self.find(key, his, lambda item, index: snapshot.__setitem__(item.key, item.value))

		return snapshot
	
	def purge(self, his = 0):
		if his == 0:
			self._items.clear()
			self._index.clear()
			self._track = 0
			return
	
		if his > len(self._items):
			his = len(self._items)

		# Delete all revisions after start
		self._items = self._items[0:his]

		# Update index
		keys = list(self._index.keys())
		self._index.clear()

		for key in keys:
			self.find(key, his, lambda item, index: self._index.__setitem__(item.key, index))

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
	expr_res, order, errors = parse_query(data["input"], HIGHWAY_OPS)

	highway_check(expr_res, errors)

	# Return a JSON response with the processed data
	return aiohttp.web.json_response({
		"expr": expr_res,
		"order": order,
		"error": errors
	})

print("Added new endpoint: /0246-parse")

######################################################################################
######################################## CODE ########################################
######################################################################################

# Special thanks to ChatGPT for this
HIGHWAY_OPS = {'>': 'set', '<': 'get', '!': 'eat'}

def parse_query(input, ops):
	# States
	inside_backticks = False
	operation = None
	name = []
	result = {value: [] for value in ops.values()}  # Initialize result with values from ops
	errors = []
	order = []  # To keep track of the order of operations
	i = 0  # Current index in the input string

	# Helper function to add a command to the result and order
	def add_command(op, name_str):
		if op and name_str:  # Only add if both operation and name are present
			result[op].append(name_str)
			order.append((op, name_str))

	# Iterate over the input string
	while i < len(input):
		char = input[i]

		# Handle operation characters
		if char in ops:
			if inside_backticks:
				name.append(char)
			elif operation is not None:
				errors.append(f"Error at char {i+1}: Multiple operation symbols")
				break
			else:
				operation = ops[char]

		# Handle backticks
		elif char == '`':
			inside_backticks = not inside_backticks
			if not inside_backticks and operation:  # Closing backtick
				if name:
					add_command(operation, ''.join(name))
				name = []
				operation = None

		# Handle valid name characters
		elif char.isalnum() or char in ['-', '_'] or (inside_backticks and char):
			if operation is not None or inside_backticks:
				name.append(char)
			else:
				errors.append(f"Error at char {i+1}: Operation symbol expected before name")
				break

		# Handle spaces
		elif char.isspace():
			if inside_backticks:
				name.append(char)
			elif name:
				add_command(operation, ''.join(name))
				name = []
				operation = None

		# Handle semicolons
		elif char == ';':
			if inside_backticks:
				name.append(char)
			elif name:  # Semicolon outside of backticks ends the current command
				add_command(operation, ''.join(name))
				name = []
				operation = None

		# Handle any other character that is not whitespace (error case)
		elif not char.isspace():
			errors.append(f"Error at char {i+1}: Invalid character '{char}'")
			break

		i += 1  # Move to the next character

	# Check if we're in a valid state after parsing all characters
	if inside_backticks:
		errors.append("Error: Unclosed backticks")

	# If there's an unfinished operation at the end
	if operation and name:
		add_command(operation, ''.join(name))

	# If there's an operation symbol but no name and no other errors
	if operation and not name and not errors:
		errors.append(f"Error at char {i + 1}: Operation '{operation}' without a name")

	# Return the result, any errors, and the order of operations
	return (result, order, errors)

def highway_check(result, errors):
	# Check if duplicate names exist within results
	exists = set()
	for name in result['set']:
		if name in exists:
			errors.append(f"Error: Duplicate input name '{name}'")
		else:
			exists.add(name)

	exists = set()
	for name in result['get'] + result['eat']:
		if name in exists:
			errors.append(f"Error: Duplicate output name '{name}'")
		else:
			exists.add(name)

def check_used(_way_in, elem):
	if elem[1] in _way_in["used"]:
		raise Exception(f"Output \"{elem[1]}\" is already used.")

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
				"_id": "UNIQUE_ID"
			}
		}

	# Amogus moment ඞ
	RETURN_TYPES = ByPassTypeTuple(("HIGHWAY_PIPE", ))
	RETURN_NAMES = ByPassTypeTuple(("_way_out", ))
	FUNCTION = "execute"
	CATEGORY = "0246"

	# [TODO] Potential recursion error when attempting to hook the inout in not a very specific way
		# => May have to keep a unique identifier for each class and each node instance
			# Therefore if already exist then throw error
				# => Cyclic detection in JS instead of python

	def execute(self, _id = None, _prompt = None, _way_in = None, _query = "", **kwargs):
		_type = _prompt[_id]["inputs"]["_type"]

		if _way_in is None:
			_way_in = {}
			_way_in["data"] = RevisionDict()
			_way_in["used"] = {}
		elif _id in _way_in["used"]:
			_way_in["data"].purge(_way_in["used"][_id])
		
		_way_in["used"][_id] = len(_way_in["data"])

		# Time to let the magic play out

		for param, key in zip(_type["in"], list(kwargs)):
			name = param["name"][1:]
			_way_in["data"][f"data.{name}"] = kwargs[key]
			_way_in["data"][f"type.{name}"] = param["type"]

		res = []

		for elem in _type["out"]:
			name = elem["name"][1:]

			if (
				f"data.{name}" in _way_in["data"] and
				elem["type"] == _way_in["data"][f"type.{name}"]
			) or elem["type"] == "*":
				res.append(_way_in["data"][f"data.{name}"])
			else:
				raise Exception(f"Output \"{name}\" is not defined or is not of type \"{elem['type']}\". Expected \"{_way_in['type'][name]}\".")

		return (_way_in, ) + tuple(res)

######################################################################################

def parse_offset(input):
	# Split the string by semicolons
	segments = input.split(';')
	
	# Initialize an empty list to store the parsed data
	parsed_data = []
	
	# Iterate over each segment
	for segment in segments:
		# Trim whitespace and check if the segment is not empty
		segment = segment.strip()
		if segment:
			# Split the segment by comma
			parts = segment.split(',')
			
			# Check if there are exactly two parts after splitting by comma
			if len(parts) != 2:
				return (None, f"Segment '{segment}' is invalid: expected a pair separated by a single comma.")
			
			# Trim whitespace from the string part
			string_part = parts[0].strip()
			
			# Ensure the string part is not empty
			if not string_part:
				return (None, f"Segment '{segment}' is invalid: string part is empty.")
			
			# Concatenate the number part to remove spaces and keep the operator
			number_part = ''.join(parts[1].split())
			try:
				# Check for multiple operators or incorrect placement
				if number_part.count('+') + number_part.count('-') > 1 or not number_part.lstrip('+-').isdigit():
					return (None, f"Segment '{segment}' is invalid: number part has multiple operators or incorrect placement.")

				# Check if the substring is an integer
				int(number_part.lstrip('+-'))
			except ValueError:
				return (None, f"Segment '{segment}' is invalid: number part is not an integer.")
			
			# Add the tuple to the list
			parsed_data.append((string_part, number_part))
	
	return (parsed_data, None)

BLACKLIST = [
	"_way_in",
	"_way_out",
	"_junc_in",
	"_junc_out",
	"..."
]

class Junction:
	@classmethod
	def INPUT_TYPES(s):
		return {
			"required": {
				"_offset": ("STRING", {
					"default": ";",
					"multiline": False
				}),
			},
			"optional": {
				"_junc_in": ("JUNCTION_PIPE", ),
			},
			"hidden": {
				"_prompt": "PROMPT",
				"_id": "UNIQUE_ID"
			}
		}
	
	RETURN_TYPES = ByPassTypeTuple(("JUNCTION_PIPE", ))
	RETURN_NAMES = ByPassTypeTuple(("_junc_out", ))
	FUNCTION = "execute"
	CATEGORY = "0246"

	def __init__(self):
		self._prev_offset = None
		self._parsed_offset = None

	def execute(self, _id = None, _prompt = None, _junc_in = None, _offset = "", **kwargs):
		_type = _prompt[_id]["inputs"]["_type"]

		if _junc_in is None:
			_junc_in = {}
			_junc_in["data"] = RevisionDict()
			_junc_in["used"] = {}
		elif _id in _junc_in["used"]:
			_junc_in["data"].purge(_junc_in["used"][_id])
		
		_junc_in["used"][_id] = len(_junc_in["data"])

		# Pack all data from _junc_in and kwargs together with the following format:

		for param, key in zip(_type["in"], list(kwargs)):
			count = 0
			for key_data in _junc_in["data"]:
				if key_data.startswith(f"data.{param['type']}"):
					count += 1
			_junc_in["data"][f"data.{param['type']}.{count}"] = kwargs[key]
			if count == 0:
				_junc_in["data"][f"index.{param['type']}"] = 0
			_junc_in["data"][f"type.{param['type']}"] = param["type"]
			count += 1

		# Parse the offset string

		if _offset != self._prev_offset:
			parsed_offset, err = parse_offset(_offset)
			if err:
				raise Exception(err)
			self._prev_offset = _offset
			self._parsed_offset = parsed_offset

		# Apply the offset to the junction input

		if self._parsed_offset is None:
			raise Exception("Offset is not parsed.")
		
		for elem in self._parsed_offset:
			for key in _junc_in["data"]:
				if key.startswith(f"data.{elem[0]}"):
					break
			else:
				raise Exception(f"Type \"{elem[0]}\" in offset string does not available in junction.")
			
			total = 0
			for key in _junc_in["data"]:
				if key.startswith(f"data.{elem[0]}"):
					total += 1

			# Check for ops char

			if elem[1][0] == '+':
				_junc_in["data"][f"index.{elem[0]}"] += int(elem[1][1:])
				temp = _junc_in["data"][f"index.{elem[0]}"]

				if temp >= total:
					raise Exception(f"Offset \"{elem[1]}\" (total: \"{temp}\") is too large (count: \"{total}\").")
			elif elem[1][0] == '-':
				_junc_in["data"][f"index.{elem[0]}"] -= int(elem[1][1:])
				temp = _junc_in["data"][f"index.{elem[0]}"]

				if temp < 0:
					raise Exception(f"Offset \"{elem[1]}\" (total: \"{temp}\") is too small (count: \"{total}\").")
			else:
				_junc_in["data"][f"index.{elem[0]}"] = int(elem[1])
				temp = _junc_in["data"][f"index.{elem[0]}"]

				if temp >= total:
					raise Exception(f"Offset \"{elem[1]}\" (total: \"{temp}\") is too large (count: \"{total}\").")
				elif temp < 0:
					raise Exception(f"Offset \"{elem[1]}\" (total: \"{temp}\") is too small (count: \"{total}\").")

		res = []
		track = {}

		for key in _junc_in["data"]:
			if key.startswith("type."):
				track[key[5:]] = 0

		for elem in _type["out"]:
			if elem["full_name"] in BLACKLIST:
				continue

			for key in _junc_in["data"]:
				if key.startswith(f"data.{elem['type']}"):
					break
			else:
				raise Exception(f"Type \"{elem['type']}\" of output \"{elem['full_name']}\" does not available in junction.")
			
			offset = _junc_in["data"][f"index.{elem['type']}"]
			real_index = track[elem["type"]] + offset
			total = 0
			for key in _junc_in["data"]:
				if key.startswith(f"data.{elem['type']}"):
					total += 1

			if real_index >= total:
				raise Exception(f"Too much type \"{elem['type']}\" being taken or offset \"{offset}\" is too large (count: \"{total}\").")
			
			res.append(_junc_in["data"][f"data.{elem['type']}.{real_index}"])
			track[elem["type"]] += 1
		
		return (_junc_in, ) + tuple(res)

######################################################################################

NODE_CLASS_MAPPINGS = {
	"Highway": Highway,
	"Junction": Junction
}

NODE_DISPLAY_NAME_MAPPINGS = {
	"Highway": "Highway",
	"Junction": "Junction"
}

######################################################################################

# Trash that may be used later, don't mind me :)
# https://pastebin.com/raw/Z3Y9HimQ