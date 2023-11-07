import uuid
import re
import pathlib
import sys

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

def check_used(_pipe_in, elem):
	if elem[1] in _pipe_in["used"]:
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
				"_pipe_in": ("HIGHWAY_PIPE", ),
			},
			"hidden": {
				"_prompt": "PROMPT",
				"_id": "UNIQUE_ID"
			}
		}

	# Amogus moment ඞ
	RETURN_TYPES = ByPassTypeTuple(("HIGHWAY_PIPE", ))
	RETURN_NAMES = ByPassTypeTuple(("_pipe_out", ))
	FUNCTION = "execute"
	CATEGORY = "0246"

	def __init__(self):
		self._prev_query = None
		self._parsed_query = None
		self._uuid = uuid.uuid4()

	# [TODO] Potential recursion error when attempting to hook the inout in not a very specific way
		# => May have to keep a unique identifier for each class and each node instance
			# Therefore if already exist then throw error
				# => Cyclic detection in JS instead of python

	def execute(self, _id = None, _prompt = None, _pipe_in = None, _query = "", **kwargs):
		_type = _prompt[_id]["inputs"]["_type"]

		if (_pipe_in is None):
			_pipe_in = {}
			_pipe_in["orig"] = self
			_pipe_in["curr"] = self
			_pipe_in["data"] = {}
			_pipe_in["type"] = {}
			_pipe_in["used"] = set()
		# elif (_pipe_in["curr"]._uuid == self._uuid):
		# 	raise Exception("Recursion error. Do not reverse the \"layering\" of the nodes.")
		else:
			_pipe_in["curr"] = self

		# Caching the parsed result if the query is the same as the previous one

		if _query != self._prev_query:
			# If it is different, parse the new query
			res, ord, err = parse_query(_query, HIGHWAY_OPS)
			highway_check(res, err)
			if len(err) > 0:
				raise Exception(err)
			
			# Update the cache with the new query and the parsed result
			self._prev_query = _query
			self._parsed_query = res
			self._parsed_order = ord

		# Time to let the magic play out

		for param, key in zip(_type["in"], list(kwargs)):
			name = param["name"][1:]
			_pipe_in["data"][name] = kwargs[key]
			_pipe_in["type"][name] = param["type"]

		res = []

		for elem in _type["out"]:
			if elem["name"][1:] in _pipe_in["data"] and _pipe_in["type"][elem["name"][1:]] == elem["type"]:
				res.append(_pipe_in["data"][elem["name"][1:]])
			else:
				raise Exception(f"Output \"{elem['name'][1:]}\" is not defined or is not of type \"{elem['type']}\".")

		return (_pipe_in, ) + tuple(res)

NODE_CLASS_MAPPINGS = {
	"Highway": Highway
}

NODE_DISPLAY_NAME_MAPPINGS = {
	"Highway": "Highway"
}

# [TODO] For "eat", still kind of buggy due to not able to force update so disabled for now
	# _pipe_in["used"].add(elem[1])
