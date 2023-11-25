import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";
import { ComfyDialog } from "../../../scripts/ui.js";
import { ComfyWidgets } from "../../../scripts/widgets.js";

(async () => {
	async function try_import(name) {
		try {
			return await import(name);
		} catch (e) {
			return null;
		}
	}

	function rgthree_exec(name, ...args) {
		return rgthree_utils?.[name]?.(...args);
	}
	
	// Shamelessly imported :3
	const rgthree_utils =  await try_import("../../../extensions/rgthree-comfy/utils.js");

	function error_popup(msg) {
		let dialog = new ComfyDialog();
		dialog.show(`<p>${msg}</p>`);
	}

	function hijack(obj, key, before_func, after_func) {
		const old_func = obj[key] ?? (() => {});
		obj[key] = function () {
			const self = this;
			const pass_obj = {
				self: self,
				stop: false,
				pre: before_func,
				post: after_func,
				old: old_func
			};
			before_func.apply(pass_obj, arguments);
			if (pass_obj.old === old_func && !pass_obj.stop)
				pass_obj.res = pass_obj.old.apply(this, arguments);
			after_func.apply(pass_obj, arguments);
			return pass_obj.res;
		};
	}

	async function async_hijack(obj, key, before_func, after_func) {
		const old_func = obj[key] ?? (() => {});
		obj[key] = async function () {
			const self = this;
			const pass_obj = {
				self: self,
				stop: false,
				pre: before_func,
				post: after_func,
				old: old_func
			};
			await before_func.apply(pass_obj, arguments);
			if (pass_obj.old === old_func && !pass_obj.stop)
				pass_obj.res = await pass_obj.old.apply(this, arguments);
			await after_func.apply(pass_obj, arguments);
			return pass_obj.res;
		};
	}

	function remove_elem_arr(array, isValid) {
		let shift = 0;

		for (let i = 0; i < array.length; ++ i) {
			if (isValid(array[i]))
				++ shift;
			else if (shift > 0)
				array[i - shift] = array[i];
		}

		array.length -= shift;
	}

	function random_id() {
		return Date.now().toString(36) + Math.random().toString(36).substring(2);
	}

	function indent_str(strings, ...values) {
		// Build the string as normal, combining all parts
		let fullString = strings.reduce((acc, str, i) => acc + (values[i - 1] || '') + str);
	
		// Split the string into lines
		let lines = fullString.split('\n');
	
		// Remove the first line if it is empty (caused by a newline at the beginning of a template literal)
		if (lines[0].match(/^\s*$/))
			lines.shift();
	
		// Find the smallest indentation (spaces or tabs) from the remaining lines that have content
		const smallestIndent = lines.length > 0
			? Math.min(...lines.filter(line => line.trim()).map(line => line.match(/^[ \t]*/)[0].length))
			: 0;
	
		// Remove the smallest indentation from all lines
		lines = lines.map(line => line.substring(smallestIndent));
	
		// Combine the trimmed lines
		return lines.join('\n');
	}

	/////////////////////////////////////////////////////////////////////////
	/////////////////////////////////////////////////////////////////////////
	/////////////////////////////////////////////////////////////////////////

	function init_type(node) {
		node.addCustomWidget({
			name: "_type",
			computeSize: () => [0, -4],
			async serializeValue (node, index_str) {
				return serialize_type(node);
			}
		});
	}

	async function init_update_raw(node, widget, callback) {
		if (node.__update || !node.__hash_update)
			node.__hash_update = random_id();
		node.__update = false;
		const temp = {
			data: widget.value,
			update: node.__hash_update,
		};
		if (callback)
			await callback(node, widget, temp);
		return temp;
	}

	function init_update(node, name) {
		node.__update = false;
		for (let i = 0; i < node.widgets.length; ++ i) {
			if (node.widgets[i].name === name) {
				node.widgets[i].serializeValue = async function (inner_node, index_str) {
					return await init_update_raw(node, node.widgets[i]);
				};
				return;
			}
		}
	}

	function init_update_direct(node, name, callback) {
		node.__update = false;
		node.addCustomWidget({
			name: name,
			computeSize: () => [0, -4],
			async serializeValue (inner_node, index_str) {
				return await init_update_raw(node, this, callback);
			}
		});
	}

	function serialize_type(node) {
		let data = {
			in: [],
			out: []
		}
		if (node.inputs)
			for (let i = 0; i < node.inputs.length; ++ i) {
				if (BLACKLIST.includes(node.inputs[i].name))
					continue;
				data.in.push({
					name: node.inputs[i].orig_name,
					full_name: node.inputs[i].name,
					type: node.inputs[i].type,
				});
			}
		if (node.outputs)
			for (let i = 0; i < node.outputs.length; ++ i) {
				if (BLACKLIST.includes(node.outputs[i].name))
					continue;
				data.out.push({
					name: node.outputs[i].orig_name,
					full_name: node.outputs[i].name,
					type: node.outputs[i].type,
				});
			}
		return data;
	}

	function link_shift_up(node, arr, index, flag, link_callback) {
		// Disconnect event handler
		const old_func = node.onConnectionsChange;
		node.onConnectionsChange = null;
		const old_in_func = node.onConnectInput;
		node.onConnectInput = null;
		const old_out_func = node.onConnectOutput;
		node.onConnectOutput = null;

		// Shift up all links

		if (flag) {
			if (arr[index].links.length === 0) {
				node.removeOutput(index);
				for (let i = 0, c = 0; i < arr.length; ++ i) {
					if (BLACKLIST.includes(arr[i].name))
						continue;
					arr[i].name = `${arr[i].type}:${c}`;
					++ c;
				}
			}
		} else {
			node.removeInput(index);

			for (let i = 0, c = 0; i < arr.length; ++ i) {
				if (BLACKLIST.includes(arr[i].name))
					continue;
				arr[i].name = `${c}:${arr[i].type}`;
				++ c;
			}
		}
		
		// Revert things back
		node.onConnectionsChange = old_func;
		node.onConnectInput = old_in_func;
		node.onConnectOutput = old_out_func;

		return;
	}

	const BLACKLIST = [
		"_way_in",
		"_way_out",
		"_junc_in",
		"_junc_out",
		"_query",
		"_offset",
		// "_node_head",
		// "_node_tail",
		"_node",
		"_event",
		"..."
	];

	const LEGACY_BLACKLIST = {
		prev: ["_pipe_in", "_pipe_out"],
		next: ["_way_in", "_way_out"],
	};

	/////////////////////////////////////////////////////////////////////////
	/////////////////////////////////////////////////////////////////////////
	/////////////////////////////////////////////////////////////////////////

	function setup_sole_pin(node, name, side_name, side_mode, shape) {
		const upper_name = side_name.charAt(0).toUpperCase() + side_name.slice(1),
			more_name = side_name + "s";

		hijack(node, "onConnect" + upper_name, () => {}, function () {
			if (this.self[more_name][arguments[0]].name !== name)
				return true;

			this.self[more_name][arguments[0]].shape = shape;
			this.self[more_name][arguments[0]].type = arguments[2].type;
		});

		hijack(node, "onConnectionsChange", () => {}, function (type, index, connected, link_info) {
			if (link_info === null) {
				// Clean up when copy paste or template load
				if (this.self[more_name])
					for (let i = 0; i < this.self[more_name].length; ++ i)
						if (this.self[more_name][i].name === name) {
							this.self[more_name][i].type = "*";
							break;
						}
				return;
			}
			
			if (!connected && index < this.self[more_name].length && this.self[more_name][index].name === name && type === side_mode)
				this.self[more_name][index].type = "*";
		});
	}

	function setup_expand(node, name, real, pin, shape, callback) {
		const upper_name = name.charAt(0).toUpperCase() + name.slice(1),
			more_name = name + "s";

		node["add" + upper_name](pin, "*");

		if (node[more_name])
			for (let i = 0; i < node[more_name].length; ++ i)
				if (node[more_name][i].name === pin) {
					node[more_name][i].shape = shape;
					break;
				}

		hijack(node, "configure", () => {}, function (data) {
			if (this.self[more_name])
				for (let i = 0; i < this.self[more_name].length; ++ i) {
					if (!BLACKLIST.includes(this.self[more_name][i].name))
						++ real[name];
				}
		});

		node["onConnect" + upper_name] = function (
			this_slot_index,
			other_slot_type,
			other_slot_obj,
			other_node,
			other_slot_index
		) {
			this.__update = true;

			if (
				BLACKLIST.includes(this[more_name][this_slot_index].name) &&
				this[more_name][this_slot_index].name !== pin
			)
				return true;

			if (callback.apply({ self: this, name: name, mode: 0 }, arguments))
				return true;

			callback.call({ self: this, name: name, mode: 1 }, real[name] ++, this[more_name][this_slot_index].type, this_slot_index);
			
			this["add" + upper_name](pin, "*");
			this[more_name][this[more_name].length - 1].shape = shape;

			return true;
		};

		hijack(node, "onConnectionsChange", () => {}, function (type, index, connected, link_info) {
			if (link_info === null) {
				// Clean up when copy paste or template load
				if (this.self[more_name])
					remove_elem_arr(this.self[more_name], (e) => !BLACKLIST.includes(e.name));
					this.self.computeSize();
				return;
			}
			
			if (!connected)
				callback.apply({ self: this.self, name: name, mode: 2 }, arguments);
		});
	}

	function junction_impl(nodeType, nodeData, app, name, shape_in, shape_out) {
		nodeType.prototype.onNodeCreated = function () {
		
			init_type(this);
		
			if (typeof name === "string")
				init_update(this, name);

			const real = {
				input: 0,
				output: 0,
			};
			
			setup_expand(this, "input", real, "...", shape_in, function () {
				switch (this.mode) {
					case 0: {
						if (this.self.inputs[arguments[0]].link !== null) {
							app.graph.links[this.self.inputs[arguments[0]].link].replaced = true;
							return true;
						}
						this.self.inputs[arguments[0]].type = arguments[2].type;
					} break;
					case 1: {
						this.self.inputs[arguments[2]].name = `${arguments[0]}:${arguments[1]}`;
					} break;
					case 2: {
						if (arguments[0] === 1) {
							let link_info = arguments[3];
							if (BLACKLIST.includes(this.self.inputs[link_info.target_slot].name) || link_info.replaced)
								return;
							link_shift_up(this.self, this.self.inputs, link_info.target_slot, false, (link_index, extra_link_index) => {
								return this.self.inputs[link_index].link;
							});
							-- real.input;
						}
					} break;
				}
			});

			setup_expand(this, "output", real, "...", shape_out, function () {
				switch (this.mode) {
					case 0: {
						if (this.self.outputs[arguments[0]].links && this.self.outputs[arguments[0]].links.length > 0)
							return true;

						if (arguments[2].__outputType) // Reroute
							this.self.outputs[arguments[0]].type = arguments[2].__outputType;
						// else if (arguments[2].defaultConnectionsLayout) // Reroute (rgthree)
						// 	this.self.outputs[arguments[0]].type = arguments[2].type;
						else
							this.self.outputs[arguments[0]].type = arguments[2].type;
					} break;
					case 1: {
						this.self.outputs[arguments[2]].name = `${arguments[1]}:${arguments[0]}`;
					} break;
					case 2: {
						if (arguments[0] === 2) {
							let link_info = arguments[3];
							if (BLACKLIST.includes(this.self.outputs[link_info.origin_slot].name))
								return;
							if (!this.self.outputs[link_info.origin_slot].links || this.self.outputs[link_info.origin_slot].links.length === 0) {
								link_shift_up(this.self, this.self.outputs, link_info.origin_slot, true, (link_index, extra_link_index) => {
									return this.self.outputs[link_index].links[extra_link_index];
								});
								-- real.output;
							}
						}
					} break;
				}
			});
		};

		rgthree_exec("addHelp", nodeType, app);
		rgthree_exec("addConnectionLayoutSupport", nodeType, app);

		nodeType.help = indent_str `
			_offset is used to skip data ahead for specific type (since internally it's a sequence of data).

			_offset is persistent and will retains information across linked Junction.
			
			The _offset syntax goes as follow:
			
				type,1
					- type is the type (usually LATENT, MODEL, VAE, etc.) and 1 is the index being set.
				type,+2
					- Same as above but instead of set offset, it increase the offset instead.
				type,-2
					- Decrease offset.
				type1, -1; type2, +2; type3, 4
					- Multiple offset.
		`;
	}

	function setup_loop_update(node) {
		for (let i = 0; i < node.widgets.length; ++ i) {
			if (node.widgets[i].name === "_update") {
				node.widgets.splice(i, 1);
				init_update_direct(node, "_update");
				break;
			}
		}
	}

	function single_impl(nodeType, nodeData, app, shape_in, pin_list) {
		nodeType.prototype.onNodeCreated = function () {
		
			init_type(this);

			const real = {
				input: 0,
			};

			setup_loop_update(this);
			
			if (shape_in !== null)
				setup_expand(this, "input", real, "...", shape_in, function () {
					switch (this.mode) {
						case 0: {
							if (this.self.inputs[arguments[0]].link !== null) {
								app.graph.links[this.self.inputs[arguments[0]].link].replaced = true;
								return true;
							}
							this.self.inputs[arguments[0]].type = arguments[2].type;
						} break;
						case 1: {
							this.self.inputs[arguments[2]].name = `${arguments[0]}:${arguments[1]}`;
						} break;
						case 2: {
							if (arguments[0] === 1) {
								let link_info = arguments[3];
								if (BLACKLIST.includes(this.self.inputs[link_info.target_slot].name) || link_info.replaced)
									return;
								link_shift_up(this.self, this.self.inputs, link_info.target_slot, false, (link_index, extra_link_index) => {
									return this.self.inputs[link_index].link;
								});
								-- real.input;
							}
						} break;
					}
				});

			for (let i = 0; i < pin_list.length; i += 4)
				setup_sole_pin(this, pin_list[i], pin_list[i + 1], pin_list[i + 2], pin_list[i + 3]);
		}
	}

	function raw_setup_log(self) {
		self.log_widget = ComfyWidgets["STRING"](self, "output", ["STRING", { multiline: true }], app).widget;
		self.log_widget.inputEl.readOnly = true;
		self.log_widget.serializeValue = async (node, index) => {
			node.widgets_values[index] = "";
			return "";
		};
	}

	function setup_log(nodeType) {
		hijack(nodeType.prototype, "onNodeCreated", () => {}, function () {
			raw_setup_log(this.self);
		});
		hijack(nodeType.prototype, "onExecuted", () => {}, function (message) {
			this.self.log_widget.value = message.text[0];
		});
	}

	app.registerExtension({
		name: "0246.Node",
		nodeCreated(node) {
			switch (node.comfyClass) {
				case "Highway": {
					node.color = LGraphCanvas.node_colors.brown.color;
					node.bgcolor = LGraphCanvas.node_colors.brown.bgcolor;
				} break;
				case "Junction": {
					node.color = LGraphCanvas.node_colors.blue.color;
					node.bgcolor = LGraphCanvas.node_colors.blue.bgcolor;
				} break;
				case "JunctionBatch": {
					node.color = LGraphCanvas.node_colors.blue.color;
					node.bgcolor = LGraphCanvas.node_colors.pale_blue.bgcolor;
				} break;
				case "Mimic": {
					node.color = LGraphCanvas.node_colors.yellow.color;
					node.bgcolor = LGraphCanvas.node_colors.red.bgcolor;
				} break;
				case "Loop": {
					node.color = LGraphCanvas.node_colors.yellow.color;
					node.bgcolor = LGraphCanvas.node_colors.yellow.bgcolor;
				} break;
				case "Count": {
					node.color = LGraphCanvas.node_colors.yellow.color;
					node.bgcolor = LGraphCanvas.node_colors.green.bgcolor;
				} break;
				case "Hold": {
					node.color = LGraphCanvas.node_colors.yellow.color;
					node.bgcolor = LGraphCanvas.node_colors.pale_blue.bgcolor;
				} break;
				case "Beautify": {
					node.color = "#652069";
					node.bgcolor = "#764378";
				} break;
				case "Random": {
					node.color = LGraphCanvas.node_colors.green.color;
				} break;
			}
		},
		async beforeRegisterNodeDef (nodeType, nodeData, app) {
			if (nodeData.category === "0246") {
				switch (nodeData.name) {
					case "Highway": {
						nodeType.prototype.onNodeMoved = function () {};

						nodeType.prototype.onNodeCreated = function () {
							hijack(this, "configure", () => {}, function (data) {
								// Patch legacy nodes
								for (let i = 0; i < this.self.inputs.length; ++ i) {
									if (LEGACY_BLACKLIST.prev.includes(this.self.inputs[i].name))
									this.self.inputs[i].name = LEGACY_BLACKLIST.next[i];
								}
								for (let i = 0; i < this.self.outputs.length; ++ i) {
									if (LEGACY_BLACKLIST.prev.includes(this.self.outputs[i].name))
									this.self.outputs[i].name = LEGACY_BLACKLIST.next[i];
								}
							});

							let last_query = "";

							init_type(this);

							init_update(this, "_query");

							this.addWidget("button", "Update", null, () => {
								const query = this.widgets.find(w => w.name === "_query");

								// POST query to server
								fetch(window.location.origin + "/0246-parse", {
									method: "POST",
									headers: {
										"Content-Type": "application/json",
									},
									body: JSON.stringify({
										"input": query.value,
									}),
								}).then(response => {
									if (response.ok) {
										return response.json();
									} else {
										throw new Error("Network response was not ok.");
									}
								}).then(data => {
									if (data.error.length > 0) {
										error_popup(data.error.join("\n"));
										query.value = last_query;
										return;
									}

									this.__update = true;

									last_query = query.value;

									let prev = [];

									// Save previous inputs and outputs
									for (let i = 0; i < this.inputs.length; ++ i) {
										if (!BLACKLIST.includes(this.inputs[i].name) && this.inputs[i].link !== null)
											prev.push({
												flag: false,
												name: this.inputs[i].orig_name,
												node_id: app.graph.links[this.inputs[i].link].origin_id,
												slot_id: app.graph.links[this.inputs[i].link].origin_slot,
											});
									}
									for (let i = 0; i < this.outputs.length; ++ i) {
										if (!BLACKLIST.includes(this.outputs[i].name) && this.outputs[i].links !== null)
											for (let j = 0; j < this.outputs[i].links.length; ++ j)
												prev.push({
													flag: true,
													name: this.outputs[i].orig_name,
													node_id: app.graph.links[this.outputs[i].links[j]].target_id,
													slot_id: app.graph.links[this.outputs[i].links[j]].target_slot,
												});
									}

									// Clear all inputs and outputs except any that in BLACKLIST
									for (let i = this.inputs.length; i -- > 0;) {
										if (!BLACKLIST.includes(this.inputs[i].name))
											this.removeInput(i);
									}
									for (let i = this.outputs.length; i -- > 0;) {
										if (!BLACKLIST.includes(this.outputs[i].name))
											this.removeOutput(i);
									}

									// Add new inputs and outputs
									for (let i = 0; i < data.order.length; ++ i) {
										switch (data.order[i][0]) {
											case "set": {
												this.addInput(`+${data.order[i][1]}`, "*");
											} break;
											case "get":{
												this.addOutput(`-${data.order[i][1]}`, "*");
											} break;
											case "eat": {
												this.addOutput(`!${data.order[i][1]}`, "*");
											} break;
										}
									}

									for (let i = 0; i < this.inputs.length; ++ i)
										this.inputs[i].orig_name = this.inputs[i].name;
									for (let i = 0; i < this.outputs.length; ++ i)
										this.outputs[i].orig_name = this.outputs[i].name;

									// Restore previous inputs and outputs
									for (let i = 0; i < prev.length; ++ i) {
										// Check if input/output still exists
										if (prev[i].flag) {
											for (let j = 0; j < this.outputs.length; ++ j) {
												if (this.outputs[j].orig_name === prev[i].name) {
													this.connect(
														j,
														prev[i].node_id,
														prev[i].slot_id
													);
													break;
												}
											}
										} else {
											for (let j = 0; j < this.inputs.length; ++ j) {
												if (this.inputs[j].orig_name === prev[i].name) {
													app.graph.getNodeById(prev[i].node_id).connect(
														prev[i].slot_id,
														this,
														j
													);
													break;
												}
											}
										}
									}
								});
							});

							this.onConnectInput = function (
								this_target_slot_index,
								other_origin_slot_type,
								other_origin_slot_obj,
								other_origin_node,
								other_origin_slot_index
							) {
								this.__update = true;

								if (BLACKLIST.includes(this.inputs[this_target_slot_index].name))
									return true;

								if (this.inputs[this_target_slot_index].link !== null) {
									// Prevent premature link kill
									app.graph.links[this.inputs[this_target_slot_index].link].replaced = true;
									return true;
								}
								
								let curr_pin = this.inputs[this_target_slot_index];
								curr_pin.type = other_origin_slot_obj.type;
								curr_pin.name = `${curr_pin.orig_name}:${curr_pin.type}`;

								return true;
							};

							this.onConnectOutput = function (
								this_origin_slot_index,
								other_target_slot_type,
								other_target_slot_obj,
								other_target_node,
								other_target_slot_index
							) {
								// We detect if we're connecting to Reroute here by checking other_target_node.type === "Reroute"
								// return false for not allowing connection
								this.__update = true;
								
								if (BLACKLIST.includes(this.outputs[this_origin_slot_index].name))
									return true;

								let curr_pin = this.outputs[this_origin_slot_index];

								if (other_target_node.__outputType) // Reroute
									curr_pin.type = other_target_node.__outputType;
								else if (other_target_node.defaultConnectionsLayout) // Reroute (rgthree)
									// rgthree accept this anyways so whatever since too lazy to properly do graph traversal
									// EDIT: I was wrong, I have to do it, but not here :(
									curr_pin.type = other_target_slot_obj.type; 
								else
									curr_pin.type = other_target_slot_obj.type;

								curr_pin.name = `${curr_pin.type}:${curr_pin.orig_name}`;

								return true;
							};

							this.onConnectionsChange = function (type, index, connected, link_info) {
								if (link_info === null) {
									// Clean up when copy paste or template load
									for (let i = 0; i < this.inputs.length; ++ i)
										if (!BLACKLIST.includes(this.inputs[i].name)) {
											this.inputs[i].name = this.inputs[i].orig_name;
											this.inputs[i].type = "*";
										}
									for (let i = 0; i < this.outputs.length; ++ i)
										if (!BLACKLIST.includes(this.outputs[i].name)) {
											this.outputs[i].name = this.outputs[i].orig_name;
											this.outputs[i].type = "*";
										}
									this.computeSize();
									return;
								}

								if (!connected) {
									switch (type) {
										case 1: {
											if (BLACKLIST.includes(this.inputs[link_info.target_slot].name) || link_info.replaced)
												return;
											this.inputs[link_info.target_slot].name = this.inputs[link_info.target_slot].orig_name;
											this.inputs[link_info.target_slot].type = "*";
										} break;
										case 2: {
											if (this.outputs[link_info.origin_slot].links.length === 0 && !BLACKLIST.includes(this.outputs[link_info.origin_slot].name)) {
												this.outputs[link_info.origin_slot].name = this.outputs[link_info.origin_slot].orig_name;
												this.outputs[link_info.origin_slot].type = "*";
											}
										} break;
										default: {
											throw new Error("Unsuported type: " + type);
										}
									}
								}
							};
						};

						rgthree_exec("addHelp", nodeType, app);
						rgthree_exec("addConnectionLayoutSupport", nodeType, app);

						nodeType.help = indent_str `
							The _query syntax goes as follow:

								>name
									- Input variable.
								<name
									- Output variable.
								>\`n!ce n@me\`
									-	Input variable but with special character and spaces (except \`, obviously).
								!name
									- Output variable, but also delete itself, preventing from being referenced further.
									- CURRENTLY BROKEN DUE TO HOW COMFYUI UPDATE THE NODES.
								<name1; >name2; !name3
									- Multiple input and outputs together.
						`;
					} break;
					case "Junction": {
						junction_impl(nodeType, nodeData, app, "_offset", LiteGraph.CIRCLE_SHAPE, LiteGraph.CIRCLE_SHAPE);
					} break;
					case "JunctionBatch": {
						// [TODO] Dynamically change shape when _mode is changed
						junction_impl(nodeType, nodeData, app, "_offset", 6, 6);
					} break;
					case "Loop": {
						single_impl(nodeType, nodeData, app, LiteGraph.CIRCLE_SHAPE, []);
					} break;
					case "Count": {
						single_impl(nodeType, nodeData, app, null, [
							"_node", "input", 1, LiteGraph.CIRCLE_SHAPE
						]);
						setup_log(nodeType);
					} break;
					case "Hold": {
						single_impl(nodeType, nodeData, app, null, [
							"_data_in", "input", 1, LiteGraph.CIRCLE_SHAPE,
							"_data_out", "output", 2, 6
						]);
						setup_log(nodeType);
					} break;
					case "Random": {
						setup_log(nodeType);
					} break;
					case "Beautify": {
						setup_log(nodeType);
					} break;
				}
			}
		},
	});

	// var curr_node = LiteGraph.createNode(LiteGraph.getNodeTypesInCategory(LiteGraph.getNodeTypesCategories()[2])[2].type);
})();