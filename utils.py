import subprocess
import sys
import ast
import importlib.util
import pathlib
import os
import torch
import itertools
import math
import collections
import random
import copy

import PIL
import numpy

contextlib = __import__("contextlib")
collection = type('CollectionModule', (), {})
setattr(collection, "abc", __import__("collections.abc"))

# Check for libs
wrapt = None
natsort = None
try:
	wrapt = __import__("wrapt")
	natsort = __import__("natsort")
except:
	subprocess.Popen([sys.executable, "-m", "pip", "install", "wrapt"]).wait()
	subprocess.Popen([sys.executable, "-m", "pip", "install", "natsort"]).wait()
	wrapt = __import__("wrapt")
	natsort = __import__("natsort")

BLACKLIST = [
	"_way_in",
	"_way_out",
	"_junc_in",
	"_junc_out",
	"..."
]

HEAD_LOG = "[ComfyUI-0️⃣ 2️⃣ 4️⃣ 6️⃣ ] "

######################################################################################
######################################## HACK ########################################
######################################################################################

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

class WildDict(dict):
	def __init__(self, *args, **kwargs):
		self.update(*args, **kwargs)

	def __contains__(self, item):
		return True
	
	def __getitem__(self, key):
		return None

class TautologyDictStr(list):
	def __init__(self, *args, **kwargs):
		self.extend(args)

	def __getitem__(self, index):
		if isinstance(index, str) or isinstance(index, int):
			return TautologyStr("")
		return super().__getitem__(index)

class OutputHandle(list):
	def __init__(self, iter):
		self.iter = iter

TautologyRest = OutputHandle(lambda: itertools.chain([False], itertools.cycle([True])))
ContradictRest = OutputHandle(lambda: itertools.chain([True], itertools.cycle([False])))
TautologyAll = OutputHandle(lambda: itertools.cycle([True]))
ContradictAll = OutputHandle(lambda: itertools.cycle([False]))

######################################################################################
######################################## UTIL ########################################
######################################################################################

@contextlib.contextmanager
def temp_dir(new_dir):
	old_dir = os.getcwd()
	os.chdir(new_dir)
	try:
		yield
	finally:
		os.chdir(old_dir)

def import_module(module_name, file_path, package_name = None):
	try:
		if module_name in sys.modules:
			return sys.modules[module_name]
		else:
			spec = importlib.util.spec_from_file_location(module_name, pathlib.Path(file_path))
			module = importlib.util.module_from_spec(spec)
			if package_name is not None:
				module.__package__ = package_name
			sys.modules[module_name] = module
			spec.loader.exec_module(module)
			return module
	except (FileNotFoundError, ModuleNotFoundError, OSError):
		return None

def args(args: list, kwargs: dict, name: str, fn, idx=None):
	arg_names = fn.__code__.co_varnames[:fn.__code__.co_argcount]
	value = None
	if name in kwargs:
		value = kwargs[name]
	else:
		try:
			# Get its position in the formal parameters list and retrieve from args
			index = arg_names.index(name)
			value = args[index] if index < len(args) else None
		except Exception:
			if idx is not None and idx < len(args):
				value = args[idx]
	return value

class RevisionDict(dict):
	def __init__(self, *args, **kwargs):
		self.update(*args, **kwargs)

	def path_count(self, path):
		count = 0
		for key in self.keys():
			if key[0:len(path)] == path:
				count += 1
		return count
	
	def path_exists(self, path):
		for key in self.keys():
			if key[0:len(path)] == path:
				return True
		return False
	
	def path_iter(self, path):
		for key in self.keys():
			if key[0:len(path)] == path:
				yield key

	def path_keys(self, path):
		res = []
		for key in self.path_iter(path):
			res.append(key[len(path):])
		return res
	
	def path_iter_arr(self, path):
		count = 0
		while (*path, count) in self:
			yield (*path, count)
			count += 1

	def sort(self, path_order, path_data, mode):
		order_keys = [key for key in self.keys() if key[:len(path_order)] == path_order]
		data_keys = [key for key in self.keys() if key[:len(path_data)] == path_data]
		order_values = [value.split(" ") for value in (self[key] for key in order_keys)]
		order_sorted = natsort.natsorted(order_values, alg=mode)

		def indices_func(i):
			if i < len(order_values):
				return order_values.index(order_sorted[i])
			else:
				return None
				
		def swap_func(curr, next):
			self[data_keys[curr]], self[data_keys[next]] = self[data_keys[next]], self[data_keys[curr]]
			self[order_keys[curr]], self[order_keys[next]] = self[order_keys[next]], self[order_keys[curr]]

		swap_index(indices_func, swap_func)

		return self

class RevisionBatch(list):
	def __init__(self, *args):
		self.extend(args)

class FlatIter:
	def __init__(self, data):
		self.data = data
		self.keys_list = list(data.keys())
		self.key_indices = {key: 0 for key in self.keys_list}
		self.index = 0
		self.elem_total = sum(len(v) for v in data.values())

	def __iter__(self):
		# Reset the indices
		self.key_indices = {key: 0 for key in self.keys_list}
		self.index = 0
		
		while self.index < self.elem_total:
			next_key = None
			next_key_index = None

			# Instead of finding the smallest value, find the next index to be incremented
			for key in self.keys_list:
				if self.key_indices[key] < len(self.data[key]):
					if next_key is None or self.key_indices[key] < next_key_index:
						next_key = key
						next_key_index = self.key_indices[key]

			if next_key is None:
				break

			# Yield the next item from the current key
			current_index = self.key_indices[next_key]
			yield next_key, self.data[next_key][current_index]

			# Increment the index for the next key and the total index
			self.key_indices[next_key] += 1
			self.index += 1

	def __getitem__(self, index):
		# Iterate to get to the item at the specified index
		for i, item in enumerate(self):
			if i == index:
				return item
		raise IndexError("Index out of range")

def flat_zip(names, flat_iter: FlatIter):
	keys_list = list(flat_iter.data.keys())

	for key, value in flat_iter:
		yield names[keys_list.index(key)], (key, value)

class ChunkIterator:
	def __init__(self, base_iterator, chunk_size, fill):
		self.base_iterator = base_iterator
		self.chunk_size = chunk_size
		self.fill = fill
		self.count = 0

	def __iter__(self):
		return self

	def __next__(self):
		if self.count < self.chunk_size:
			try:
				item = next(self.base_iterator)
				self.count += 1
				return item
			except StopIteration:
				if self.fill and self.count > 0:
					self.count += 1
					return None
				raise
		else:
			raise StopIteration

def take(iterable, chunk, build, fill=False):
	iterator = iter(iterable)
	while True:
		chunk_iter = ChunkIterator(iterator, chunk, fill)
		built_chunk = build(item for item in chunk_iter)

		# Check if the chunk is empty, which indicates the iterator is exhausted
		if not built_chunk and next(chunk_iter, None) is None:
			break
		yield built_chunk

def dict_product(dict_list):
	keys, values = zip(*dict_list.items())
	for combination in itertools.product(*(enumerate(value) for value in values)):
		yield (
			{k: v for k, (index, v) in zip(keys, combination)},
			{k: index for k, (index, v) in zip(keys, combination)}
		)

def dict_slice(dict_list, build=lambda _: _):
	for i in range(max((len(v) for v in dict_list.values()), default=0)):
		curr = dict()
		index_info = dict()
		for k, v in dict_list.items():
			actual_index = i if i < len(v) else len(v) - 1 # Handles the case where i exceeds the list length
			curr[k] = build(v[actual_index])
			index_info[k] = actual_index
		yield (curr, index_info)

def dict_iter(dict_inst):
	dq = collections.deque(((key,), value) for key, value in dict_inst.items())

	while dq:
		current_path, current_value = dq.popleft()
		if isinstance(current_value, collections.abc.Mapping):
			for key in reversed(current_value):
				dq.appendleft((current_path + (key,), current_value[key]))
		else:
			yield current_path

def dict_get(dict_inst, tuple_path, val=None, build=dict):
	curr = dict_inst
	for key in tuple_path[:-1]:
		if key not in curr:
			curr[key] = build()
		curr = curr[key]
	return curr.get(tuple_path[-1], val)

def dict_set(dict_inst, tuple_path, val, build=dict):
	curr = dict_inst
	for key in tuple_path[:-1]:
		if key not in curr:
			curr[key] = build()
		curr = curr[key]
	curr[tuple_path[-1]] = val

def transpose(iter, build):
	if not isinstance(iter[0], collections.abc.Iterable):
		for item in iter:
			yield build((item, ))
	else:
		for item in zip(*iter):
			yield build(item)

def flat_iter(iter, layer = 0, func=lambda _: isinstance(_, collections.abc.Iterable), **kwargs):
	__layer__ = kwargs.get("__layer__", 0)
	for elem in iter:
		if func(elem) and __layer__ < layer:
			yield from flat_iter(elem, layer, func, __layer__=__layer__ + 1)
		else:
			yield elem, __layer__

def cycle_iter(func, iterable, sentinel=object()):
	for item in itertools.cycle(itertools.chain(iterable, [sentinel])):
		if item == sentinel:
			if func():
				break
			continue
		yield item

def stub_param_handle(*args, **kwargs):
	return None, tuple(), {}

def hijack(scope, name, param_func = stub_param_handle, res_func = None, out_scope = None):
	old_func = getattr(scope, name)
	def new_func(*args, **kwargs):
		call_func, new_args, new_kwargs = param_func(*args, **kwargs)
		final_args = tuple(new_args[i] if i < len(new_args) else args[i] for i in range(len(args)))
		for key in new_kwargs:
			kwargs[key] = new_kwargs[key]
		res_value = None
		if call_func is None:
			res_value = old_func(*final_args, **kwargs)
		else:
			res_value = call_func(old_func, *final_args, **kwargs)
		return res_value if res_func is None else res_func(res_value, *final_args, **kwargs)
	setattr(scope if out_scope is None else out_scope, name, new_func)

class Wrapper(wrapt.ObjectProxy):
	_0246 = None
	def __init__(self, wrapped, data):
		super().__init__(wrapped)
		self._0246 = data

	def __deepcopy__(self, memo):
		return Wrapper(copy.deepcopy(self.__wrapped__, memo), copy.deepcopy(self._0246, memo))

def check_update(data):
	if isinstance(data, list):
		data = data[0]
	if isinstance(data, str):
		data = ast.literal_eval(data) # [TODO] Maybe properly handle this in the future
	return data["update"]

def at_idx(head, rest, index):
	full_length = len(rest) + 1
	norm_index = index % full_length
	if norm_index == 0:
		return head
	return rest[norm_index - 1]

def len_zero_arr(data):
	return 0 if data[0] is None else len(data)

def append_replace(arr, index, value):
	if index >= len(arr):
		arr.append(value)
	else:
		arr[index] = value

def beautify_structure(data, indent=0, mode=0, stop=False):
	"""
	Recursively format the structure of a dictionary, list, or tuple without formatting the actual data.
	Now it format the structure for each element within lists and tuples.
	"""
	# Determine the indentation string
	indent_str = '  ' * indent
	res_str = ""

	if isinstance(data, dict):
		res_str += f"{indent_str}Dict of {len(data)}:\n"
		for key, value in data.items():
			res_str += f"{indent_str}  Key ({type(key).__name__}): {key}\n"
			res_str += beautify_structure(value, indent + 1, mode)
	elif isinstance(data, list):
		res_str += f"{indent_str}List of {len(data)}:\n"
		for item in data:
			res_str += beautify_structure(item, indent + 1, mode)
	elif isinstance(data, tuple):
		res_str += f"{indent_str}Tuple of {len(data)}:\n"
		for item in data:
			res_str += beautify_structure(item, indent + 1, mode)
	elif isinstance(data, set):
		res_str += f"{indent_str}Set of {len(data)}:\n"
		for item in data:
			res_str += beautify_structure(item, indent + 1, mode)
	else:
		res_str += f"{indent_str}Type: {(type(data.__wrapped__).__name__ + ' (wrap)') if isinstance(data, Wrapper) else type(data).__name__}\n"
		# Attempt to loop through each attribute
		match mode:
			case 1:
				try:
					if isinstance(data, str) or isinstance(data, torch.Tensor):
						raise TypeError("stub")
					iterator = iter(data) # Try to get an iterator from data.
					if hasattr(data, '__len__'):
						res_str += f"{indent_str}Iterable of {len(data)}:\n"
					else:
						res_str += f"{indent_str}Iterable:\n"
					for item in iterator:
						res_str += beautify_structure(item, indent + 1, mode)
				except TypeError:
					# If data is not iterable, just print its repr.
					res_str += f"{indent_str}  Data: {repr(data.__wrapped__) if isinstance(data, Wrapper) else repr(data)}\n"
			case 2:
				try:
					if isinstance(data, (int, float, str, bool, type(None))):
						res_str += f"{indent_str}  Data: {repr(data.__wrapped__) if isinstance(data, Wrapper) else repr(data)}\n"
					else:
						for attr in dir(data):
							attr_value = getattr(data, attr)
							if attr.startswith('_') or callable(attr_value):
								continue

							if isinstance(attr_value, (int, float, str, bool, type(None))):
								res_str += f"{indent_str}  Attribute: {attr}\n"
								res_str += f"{indent_str}  Type: {type(attr_value).__name__}\n"
								res_str += f"{indent_str}    Data: {repr(attr_value)}\n"
							elif isinstance(attr_value, (dict, list, tuple, set)):
								res_str += f"{indent_str}  Attribute: {attr}\n"
								res_str += beautify_structure(attr_value, indent + 2, mode, True)
							elif stop:
								res_str += f"{indent_str}  {attr} ({type(attr_value).__name__}): {attr_value}\n"
							else:
								res_str += f"{indent_str}  Attribute: {attr}\n"
								res_str += beautify_structure(attr_value, indent + 2, mode, True)
				except Exception as e:
					pass
			case _:
				pass

	return res_str

def param(sign_args, sign_kwargs, data_args, data_kwargs, build_list, build_dict):
	data_args_iter = iter(data_args)
	return build_list(itertools.islice(data_args_iter, len(sign_args))), build_dict(itertools.chain(
		zip(iter(sign_kwargs), data_args_iter),
		((key, sign_kwargs[key]) for key in sign_kwargs),
		((key, data_kwargs[key]) for key in data_kwargs)
	))

def norm(val, min, max):
	return (val - min) / (max - min)

def lerp(norm, min, max):
	return min + (max - min) * norm

def map(val, min, max, new_min, new_max):
	return lerp(norm(val, min, max), new_min, new_max)

def swap_index(index_func, swap_func):
	visited = {}
	i = 0
	while True:
		mapped_index = index_func(i)
		if mapped_index is None:
			break
		if i not in visited:
			current = i
			next_index = mapped_index
			while not visited.get(next_index, False):
				swap_func(current, next_index)
				visited[current] = True
				current = next_index
				next_index = index_func(current)
		i += 1

def sort_dict_of_list(dict_of_lists, sort_key, key_func=lambda x: x):
	sorted_indices = sorted(range(len(dict_of_lists[sort_key])), key=lambda k: key_func(dict_of_lists[sort_key][k]))

	def index_func(i):
		if i < len(sorted_indices):
			return sorted_indices[i]
		return None

	# Swap function that swaps elements in all lists of the dictionary
	def swap_func(i, j):
		for key in dict_of_lists:
			dict_of_lists[key][i], dict_of_lists[key][j] = dict_of_lists[key][j], dict_of_lists[key][i]

	swap_index(index_func, swap_func)

	return dict_of_lists

def snap(num, step):
	if num > 0:
		return math.floor(num / step) * step
	return math.ceil(num / step) * step

def snap_place(num, func=round, place=0):
	return func(num * 10 ** place) / 10 ** place

def random_order(data, k, rand_inst = random):
	pick = 0
	for i, curr in enumerate(data):
		prob = (k - pick) / (len(data) - i)
		if rand_inst.random() < prob:
			yield curr
			pick += 1

def toposort(data, key_func=lambda x: x):
	if len(data) == 0:
		return

	# Convert dependencies to lists, removing self-dependencies
	data = {item: [e for e in dep if e != item] for item, dep in data.items()}

	# Identify extra items in dependencies that aren't keys in the data dictionary
	extra_items_in_deps = []
	for values in data.values():
		for value in values:
			if value not in data:
				extra_items_in_deps.append(value)
	
	# Add these extra items to the data dictionary with empty dependency lists
	for item in extra_items_in_deps:
		if item not in data:
			data[item] = []

	while True:
		# Find items without dependencies
		ordered = [item for item, dep in data.items() if len(dep) == 0]
		ordered.sort(key=key_func)  # Sort to maintain a consistent order

		if not ordered:
			break

		yield ordered

		# Remove the ordered items from the dependencies of remaining items
		data = {item: [dep for dep in deps if dep not in ordered] 
			for item, deps in data.items() if item not in ordered}

def parse_parentheses(string):
	# Custom version
	result = []
	current_item = ""
	nesting_level = 0
	for char in string:
		if char == "(":
			if nesting_level == 0:
				if current_item:
					if current_item.strip():
						result.append(current_item.strip())
					current_item = "("
				else:
					current_item = "("
			else:
				current_item += char
			nesting_level += 1
		elif char == ")":
			nesting_level -= 1
			if nesting_level == 0:
				if current_item.strip():
					result.append(current_item.strip() + ")")
				current_item = ""
			else:
				current_item += char
		elif char == ",":
			if nesting_level == 0:
				if current_item.strip():
					result.append(current_item.strip())
				current_item = ""
			else:
				current_item += char
		else:
			current_item += char
	if current_item and current_item.strip():
		result.append(current_item.strip())
	return result

def tensor2pil(image):
	return PIL.Image.fromarray(numpy.clip(255. * image.cpu().numpy().squeeze(), 0, 255).astype(numpy.uint8))

def pil2tensor(image):
	return torch.from_numpy(numpy.array(image).astype(numpy.float32) / 255.0).unsqueeze(0)

######################################################################################
######################################## LANG ########################################
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

######################################################################################

# Some secret stuff here for "Alter" node (maybe next update)

"""
# Assume we are dealing with KSampler
[0, 1, 0, 1, 0, 1] = model;
	# Input must be a batch list
	# Unnamed, which is depends on order of input pin position (currently 0)
	[0(2), 1(3)] = model; # [0, 0, 1, 1, 1]
	[0(2), 1(3), @] = model; # [0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0, etc.]
	[0(@),] = model; # [0, 0, 0, 0, etc.]
		[0(@)][1(@)] = model; # Basically always pin to arr[0][1]
	[-1] = model; # Can have negative index for last position, otherwise behave same as positive index
pos = `positive`; # Input and Output can be escaped just in case
`neg` = 2; # negative, since negative is on input pin 2 count from 0
	`neg` = !8; # negative, but use internal python func param index instead
	`neg` = !-3; # Index can be negative number
	`neg` = !negative; # Use internal python func param name
latent[0] = latent_image;
	# Same syntax within [] like model
	# Same requirement of input must be a batch list
	# Named
(1.0) = denoise; # Basic support for int, string, float and combo
(`normal`) = scheduler; # Same thing here
sampler_name; # sampler_name = sampler_name
!sampler_name; # !sampler_name = !sampler_name
6 = cfg;
	6[0] = cfg; # Optional [] with same syntax as model

[] = steps;
	# Basically act like steps = steps
	# Differ from "<num> = <name>" as this rely on input in position (currently 8)

# If pin not provided, the value will default to whatever INPUT_TYPES gives (for steps, it will be 20)
# Also support basic single line comment

@@;
	# If there only exist this within the entire code, then Highway will map param to pin name one by one
!@@;
	# Same thing here but highway key map to func param

"""

"""
# Full syntax
[0, 1, 0, 1, 0, 1] = model; # Basic inline comment
# More inline comment
[0, 1, 0, 1, 0, 1,] = model;
	# Allows indent
	[0(2), 1(3)] = model;
	[0(2), 1(3), @] = model;
	[0(@)] = model;
	[0(@),] = model;
	[-1] = model;
pos = "positive";
"neg" = 2;
neg = !8;
"neg" = !-3;
"neg" = !negative;
latent[0] = latent_image;
"latent"[0(2), 1(3)] = latent_image;
(1.0) = denoise;
("normal") = scheduler;
sampler_name;
!sampler_name = sampler;
6 = cfg;
!6 = cfg;
6[0] = cfg;
[] = steps;
"""

"""
# Execute specific node
@`class_type` {
	<param-code>
}

# Execute from group
@[`group_name`] {
	<param-code>
}

# Execute from .json graph
@(`path.json`) {
	<param-code>
}

# Execute graph from other tabs
@{`tab_name`} {
	<param-code>
}

# Output a Highway
@... ${...}
@... $`Highway`{...}

# Output a Junction
@... $${...}
@... $`Junction`{...}

# Output a Junction Batch
@... $$${...}
@... $`JunctionBatch`{...}
"""

def trim_space(line):
	while len(line) > 0 and line[0].isspace():
		line = line[1:]
	
	return line

def parse_comment(input, state):
	if input[state["idx"]] != '#':
		return True
	
	state["idx"] += 1
	temp = ""

	while state["idx"] < state["len"]:
		token = input[state["idx"]]
		if token == '\n':
			temp = trim_space(temp)
			state["res"].append({
				"type": "#",
				"value": temp
			})
			state["idx"] += 1
			return
		temp += token
		state["idx"] += 1

def parse_space(input, state):
	if not input[state["idx"]].isspace():
		return True

	while state["idx"] < state["len"]:
		if not input[state["idx"]].isspace():
			break
		state["idx"] += 1

def parse_name(input, state):
	if not input[state["idx"]].isalpha():
		return True

	temp = ""
	while state["idx"] < state["len"]:
		token = input[state["idx"]]
		if token.isalnum() or token == '_':
			temp += token
		else:
			break
		state["idx"] += 1

	state["res"].append({
		"type": "name",
		"value": temp
	})

def parse_string(input, state):
	if input[state["idx"]] != '`':
		return True

	state["idx"] += 1

	temp = ""
	while state["idx"] < state["len"]:
		token = input[state["idx"]]
		if token == '`':
			state["res"].append({
				"type": "name",
				"value": temp
			})
			state["idx"] += 1
			return
		temp += token
		state["idx"] += 1

	state["err"] = f"Error at char {state['idx']}: Unterminated \"`\""

def parse_number(input, state):
	if not (input[state["idx"]].isdigit() or input[state["idx"]] == '-'):
		return True

	temp = ""
	if input[state["idx"]] == '-':
		temp += '-'
		state["idx"] += 1

	while state["idx"] < state["len"]:
		token = input[state["idx"]]
		if token.isdigit() or token == '.':
			temp += token
		else:
			break
		state["idx"] += 1

	try:
		temp_num = None
		try:
			if temp.startswith("0x") or temp.startswith("0X"):
				temp_num = int(temp, 16)
			elif temp.startswith("0o") or temp.startswith("0O"):
				temp_num = int(temp, 8)
			elif temp.startswith("0b") or temp.startswith("0B"):
				temp_num = int(temp, 2)
			else:
				temp_num = int(temp)
		except ValueError:
				temp_num = float(temp) # Propagate
		state["res"].append({
			"type": "number",
			"value": temp_num
		})
	except ValueError:
		state["err"] = f"Error at char {state['idx']}: Invalid number char \"{temp}\""

def parse_access(input, state):
	if input[state["idx"]] != '[':
		return True

	state["idx"] += 1

	res = []
	state["res"].append(res)
	state["stk"].append(res)
	state["res"] = res

	res.append({
		"type": "[",
	})

	while state["idx"] < state["len"]:
		token: str = input[state["idx"]]
		if token == ']':
			res.append({
				"type": "]",
			})
			state["idx"] += 1
			state["stk"].pop()
			state["res"] = state["stk"][-1]
			return
		elif token == '@':
			res.append({
				"type": "@",
			})
			state["idx"] += 1
		elif token == ',':
			res.append({
				"type": ",",
			})
			state["idx"] += 1
		elif (
			parse_number(input, state) and
			parse_extra(input, state) and
			parse_comment(input, state)
		):
			state["idx"] += 1

		if state["err"] is not None:
			return
	
	state["err"] = f"Error at char {state['idx']}: Unterminated \"[\""

def parse_extra(input, state):
	if input[state["idx"]] != '(':
		return True

	state["idx"] += 1

	res = []
	state["res"].append(res)
	state["stk"].append(res)
	state["res"] = res

	res.append({
		"type": "(",
	})

	while state["idx"] < state["len"]:
		token: str = input[state["idx"]]
		if token == ')':
			res.append({
				"type": ")",
			})
			state["idx"] += 1
			state["stk"].pop()
			state["res"] = state["stk"][-1]
			return
		elif token == '@':
			res.append({
				"type": "@",
			})
			state["idx"] += 1
		elif (
			parse_number(input, state) and
			parse_string(input, state) and
			parse_comment(input, state)
		):
			state["idx"] += 1

		if state["err"] is not None:
			return
		
	state["err"] = f"Error at char {state['idx']}: Unterminated \"(\""

# LL(1) parser is enough
# Modular design to easy manage
def parse_lang(input: str):
	ast = []

	state = {
		"idx": 0,
		"len": len(input),
		"err": None
	}
	state["res"] = []
	state["stk"] = [state["res"]]

	while state["idx"] < state["len"]:
		token = input[state["idx"]]
		if token == '!':
			state["res"].append({
				"type": "!",
			})
			state["idx"] += 1
		elif token == '=':
			state["res"].append({
				"type": "=",
			})
			state["idx"] += 1
		elif token == ';' or state["idx"] == state["len"] - 1:
			ast.append(state["res"])
			state["res"] = []
			state["stk"] = [state["res"]]
			state["idx"] += 1
		elif (
			parse_space(input, state) and
			parse_name(input, state) and
			parse_string(input, state) and
			parse_access(input, state) and
			parse_extra(input, state) and
			parse_number(input, state) and
			parse_comment(input, state)
		):
			state["idx"] += 1

		if state["err"] is not None:
			return (None, state["err"])

	return (ast, None)

######################################################################################

# Trash that may be used later, don't mind me :)
# https://pastebin.com/raw/Z3Y9HimQ
# https://pastebin.com/raw/5kn6KKbT: The OG RevisionDict, if we needs it ever again
# https://pastebin.com/raw/17pwbLpr: Misc junk
# https://pastebin.com/raw/vnreX3uJ
# https://pastebin.com/raw/S9jyqpaY
# https://pastebin.com/raw/dgibNFQ5
# https://pastebin.com/raw/J3faeMgA

# JS:
# https://pastebin.com/raw/ibGnvzed
# https://pastebin.com/raw/9WLKRhJp
# https://pastebin.com/raw/AWK6EX0Z
# https://pastebin.com/raw/fhpJqfJw: OG type widget implementation
# https://pastebin.com/raw/0UL26G7p