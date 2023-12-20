import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";
import { ComfyWidgets } from "../../../scripts/widgets.js";
import { GroupNodeHandler } from "../../../extensions/core/groupNode.js";

import * as lib0246 from "./utils.js";

const HELP = {
	"highway": `
		<span>
			The _query syntax goes as follow:
		</span>
		<ul>
			<li>
				<code>&gt;name</code>
				<br>
				- Input variable.
			</li>
			<li>
				<code>&lt;name</code>
				<br>
				- Output variable.
			</li>
			<li>
				<code>&gt;\`n!ce n@me\`</code>
				<br>
				-	Input variable but with special character and spaces (except \`, obviously).
			</li>
			<li>
				<code>!name</code>
				<br>
				- Output variable, but also delete itself, preventing from being referenced further.
				<br>
				- CURRENTLY BROKEN DUE TO HOW COMFYUI UPDATE THE NODES.
			</li>
			<li>
				<code>&lt;name1; &gt;name2; !name3</code>
				<br>
				- Multiple input and outputs together.
			</li>
		</ul>
	`.replace(/[\t\n]+/g, ''),
	"junction": `
		<span>
			_offset is used to skip data ahead for specific type (since internally it's a sequence of data).
		</span>
		<br><br>
		<span>
			_offset is persistent and will retains information across linked Junction and JunctionBatch.
		</span>
		<br><br>
		<span>
			The _offset syntax goes as follow:
		</span>
		<ul>
			<li>
				<code>type,1</code>
				<br>
				- type is the type (usually LATENT, MODEL, VAE, etc.) and 1 is the index being set.
			</li>
			<li>
				<code>type,+2</code>
				<br>
				- Same as above but instead of set offset, it increase the offset instead.
			</li>
			<li>
				<code>type,-2</code>
				<br>
				- Decrease offset.
			</li>
			<li>
				<code>type1, -1; type2, +2; type3, 4</code>
				<br>
				- Multiple offset.
			</li>
		</ul>
	`.replace(/[\t\n]+/g, ''),
	"box_range": `
		<span>
			Drag from an empty space to anywhere to create a new box.
		</span>
		<br><br>
		<span>
			Click on a box to select that box.
		</span>
		<ul>
			<li>
				Clicking the same position again will cycle through each boxes that are contains that mouse position.
			</li>
		</ul>
		<span>
			Changing z-index of a box may also change z-index of other boxes.
		</span>
		<br><br>
		<span>
			If during MOVE or RESIZE state, mouse the mouse out of boundary to cancel the action.
		</span>
		<br><br>
		<span>
			If holding Shift during drag from empty space, then it will DELETE any box that are within that area.
		</span>
		<br><br>
		<span>
			When a box is selected:
		</span>
		<ul>
			<li>
				Drag the box around to MOVE it.
			</li>
			<li>
				Double click in top right to DELETE.
			</li>
			<li>
				Double click in bottom right to RESIZE.
			</li>
			<li>
				Double click in bottom left to INCREASE Z-INDEX.
			</li>
			<li>
				Double click in top left to DECREASE Z-INDEX.
			</li>
			<li>
				Hold SHIFT while clicking on the box again will prompt for specific range <code>[x, y, width, height]</code> or JS code string.
				<ul>
					<li>
						If any is <code>null</code> then it will be filled with the current boundary data for that index.
					</li>
					<li>
						If any is <code>"string"</code> then it will be implicitly assumed to be math expression and will be evaluated.
					</li>
					<li>
						If entire thing is JS then it must return an array. There's some utilities function available.
						<ul>
							<li>
								You can Ctrl-F to search for "safe_eval" within "nodes.js" and "utils.js" for more info on what's available.
							</li>
						</ul>
					</li>
				</ul>
			</li>
		</ul>
	`.replace(/[\t\n]+/g, ''),
	"hub": `
		<span>
			This node can create a NEW widget (or create a bunch of NEW widgets using an exist node as template)
		</span>
		<br><br>
		<span>
			It also can group and sync widgets data from other nodes.
		</span>
		<br><br>
		<span>
			When clicking on node title within the hub, it will select/unselect that node.
		</span>
		<ul>
			<li>
				A node is being selected when a border color is shown around the node.
			</li>
		</ul>
		<span>
			You don't have to worry about when converting tracked nodes to group since it can be detected and can auto-add the group node.
		</span>
		<ul>
			<li>
				However when manually add group node to Hub, Hub will not automatically add widgets from the expanded nodes (probably will allow this in future).
			</li>
		</ul>
		<span>
			Only built-in widgets (and Box Range) are supported. Other custom widget are probably not going to works.
		</span>
		<ul>
			<li>
				Of course you can try to group custom widgets as I tried to design Hub to be as "reactive" as possible internally.
			</li>
		</ul>
		<span>
			Unfortunately due to inherent limitation you cannot resize Hub node.
		</span>
		<br><br>
		<span>
			Also for DOM/HTML-based widgets (such as multiline text), the element will probably "flick" between the Hub and the actual node.
		</span>
		<br><br>
		<span>
			Warning:
		</span>
		<ul>
			<li>
				For any native image upload widgets, the tracked nodes will have preview image may render out of node bound. This is due to inherent limitation and I cannot fix it.
			</li>
			<li>
				Do not convert widget to input from within Hub node. Do it from the tracked node instead. I may handle this case later in future.
			</li>
			<li>
				Image preview also not rendered properly. Therefore it will need a custom widget that I will probably implement.
		</ul>
	`.replace(/[\t\n]+/g, ''),
};

let defs, type_defs = new Set();

(async () => {
	function rgthree_exec(name, ...args) {
		return rgthree_utils?.[name]?.apply(null, args);
	}

	function help_option(node, content, app) {
		// Guess this is good enough
		rgthree_exec("addHelpMenuItem", node, content, app);
	}

	// await lib0246.load_script("https://unpkg.com/interactjs@1.10.23/dist/interact.min.js");

	// Shamelessly imported :3
	const rgthree_utils =  await lib0246.try_import("../../../extensions/rgthree-comfy/utils.js");
		// mtb_widgets =  await lib0246.try_import("../../../extensions/comfy_mtb/mtb_widgets.js");

	lib0246.hijack(app, "registerNodesFromDefs", async function (_defs) {
		defs = _defs;

		for (let key in defs)
			for (let idx in defs[key].output)
				if (!Array.isArray(defs[key].output[idx]))
					type_defs.add(defs[key].output[idx]);

		type_defs = [...type_defs.values()];
	}, () => {});

	let PROCESS_WIDGET_NODE;

	/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

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
			node.__hash_update = lib0246.random_id();
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

		app.canvas.setDirty(true, false);
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
		"_pipe_in",
		"_pipe_out",
		"_query",
		"_offset",
		"_event",
		"_delimiter",
		"_script_in",
		"_script_out",
		"_exec_mode",
		"_sort_mode",
		"_mode",
		"_pad",
		"..."
	];

	const LEGACY_BLACKLIST = {
		prev: ["_pipe_in", "_pipe_out"],
		next: ["_way_in", "_way_out"],
	};

	/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

	function setup_sole_pin(node, name, side_name, side_mode, shape) {
		const upper_name = side_name.charAt(0).toUpperCase() + side_name.slice(1),
			more_name = side_name + "s";

		lib0246.hijack(node, "onConnect" + upper_name, () => {}, function () {
			if (this.self[more_name][arguments[0]].name !== name)
				return true;

			this.self[more_name][arguments[0]].shape = shape;
			this.self[more_name][arguments[0]].type = arguments[2].type;
		});

		lib0246.hijack(node, "onConnectionsChange", () => {}, function (type, index, connected, link_info) {
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

		lib0246.hijack(node, "configure", () => {}, function (data) {
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

			const res = callback.apply({ self: this, name: name, mode: 0 }, arguments);
			if (res === true)
				return true;
			if (res === false)
				return false;

			callback.call({ self: this, name: name, mode: 1 }, real[name] ++, this[more_name][this_slot_index].type, this_slot_index);
			
			this["add" + upper_name](pin, "*");
			this[more_name][this[more_name].length - 1].shape = shape;
			return true;
		};

		lib0246.hijack(node, "onConnectionsChange", () => {}, function (type, index, connected, link_info) {
			if (link_info === null) {
				// Clean up when copy paste or template load
				if (this.self[more_name])
					lib0246.remove_elem_arr(this.self[more_name], (e) => !BLACKLIST.includes(e.name));
				this.self.computeSize();
				app.canvas.setDirty(true, false);
				return;
			}
			
			if (!connected)
				callback.apply({ self: this.self, name: name, mode: 2 }, arguments);
		});
	}

	function highway_impl(nodeType, nodeData, app, shape_in, shape_out) {
		nodeType.prototype.onNodeMoved = function () {};

		nodeType.prototype.onNodeCreated = function () {
			init_type(this);

			init_update(this, "_query");

			const query = this.widgets.find(w => w.name === "_query");

			query.options = query.options ?? {};
			query.options.multiline = true;

			let last_query = "";
			
			lib0246.hijack(this, "configure", () => {}, function (data) {
				// Patch legacy nodes
				for (let i = 0; i < this.self.inputs.length; ++ i) {
					if (LEGACY_BLACKLIST.prev.includes(this.self.inputs[i].name))
						this.self.inputs[i].name = LEGACY_BLACKLIST.next[i];
				}
				for (let i = 0; i < this.self.outputs.length; ++ i) {
					if (LEGACY_BLACKLIST.prev.includes(this.self.outputs[i].name))
					this.self.outputs[i].name = LEGACY_BLACKLIST.next[i];
				}
				last_query = data.widgets_values[0];
			});

			this.addWidget("button", "Update", null, () => {
				const self = this;

				(async function () {
					let data = await (await fetch(
						window.location.origin + "/0246-parse",
						{
							method: "POST",
							headers: {
								"Content-Type": "application/json",
							},
							body: JSON.stringify({
								"input": query.value,
							}),
						}
					)).json();

					if (!data) {
						lib0246.error_popup("Server or Network error");
						return;
					}

					if (data.error.length > 0) {
						lib0246.error_popup(data.error.join("\n"));
						query.value = last_query;
						return;
					}

					last_query = query.value;

					save_parse_load_pin(self, shape_in, shape_out, (node, prev, mode) => {
						if (mode) {
							for (let i = 0; i < data.order.length; ++ i) {
								switch (data.order[i][0]) {
									case "get":{
										node.addOutput(`-${data.order[i][1]}`, "*");
									} break;
									case "eat": {
										node.addOutput(`!${data.order[i][1]}`, "*");
									} break;
								}
							}
						} else {
							for (let i = 0; i < data.order.length; ++ i) {
								switch (data.order[i][0]) {
									case "set": {
										node.addInput(`+${data.order[i][1]}`, "*");
									} break;
								}
							}
						}
					});

					// node_fit(self, query, self.widgets.filter(_ => _.name === "Update")[0]);
				})();
			}, {
				serialize: false
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
				if (curr_pin.orig_type === "*")
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

				if (curr_pin.orig_type === "*") {
					if (other_target_node.__outputType) // Reroute
						curr_pin.type = other_target_node.__outputType;
					else if (other_target_node.defaultConnectionsLayout) // Reroute (rgthree)
						// rgthree accept this anyways so whatever since too lazy to properly do graph traversal
						// EDIT: I was wrong, I have to do it, but not here :(
						curr_pin.type = other_target_slot_obj.type; 
					else
						curr_pin.type = other_target_slot_obj.type;
				}

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
							if (this.inputs[link_info.target_slot].orig_type === "*")
								this.inputs[link_info.target_slot].type = "*";
						} break;
						case 2: {
							if (this.outputs[link_info.origin_slot].links.length === 0 && !BLACKLIST.includes(this.outputs[link_info.origin_slot].name)) {
								this.outputs[link_info.origin_slot].name = this.outputs[link_info.origin_slot].orig_name;
								if (this.outputs[link_info.origin_slot].orig_type === "*")
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

		lib0246.hijack(nodeType.prototype, "getExtraMenuOptions", function (canvas, options) {
			// canvas === app.canvas
			
			// value: parent submenu obj
			// options: this.extra == node, scroll_speed, event: litegraph event
			// evt: native event object
			// menu
			// node

			options.push(
				{
					content: "[0246.Highway] Selected node pins -> highway pins",
					callback: (value, options, evt, menu, node) => {
						for (let node_id in app.canvas.selected_nodes) {
							if (node.id === Number(node_id))
								continue;
							save_parse_load_pin(node, shape_in, shape_out, (node, prev, mode) => {
								const from = app.graph.getNodeById(Number(node_id));
								if (mode) {
									copy_output_pin(node, from, "output", "<");
								} else {
									if (defs[from.comfyClass]?.input?.required)
										copy_input_pin(node, from, "input", "input", "required", ">");
									if (defs[from.comfyClass]?.input?.optional)
										copy_input_pin(node, from, "input", "input", "optional", ">");
								}
							});
						}
					}
				},
				{
					content: "[0246.Highway] Selected node pins -> highway pins (inverse)",
					callback: (value, options, evt, menu, node) => {
						for (let node_id in app.canvas.selected_nodes) {
							if (node.id === Number(node_id))
								continue;
							save_parse_load_pin(node, shape_in, shape_out, (node, prev, mode) => {
								const from = app.graph.getNodeById(Number(node_id));
								if (!mode) {
									copy_output_pin(node, from, "input", ">");
								} else {
									if (defs[from.comfyClass]?.input?.required)
										copy_input_pin(node, from, "input", "output", "required", "<");
									if (defs[from.comfyClass]?.input?.optional)
										copy_input_pin(node, from, "input", "output", "optional", "<");
								}
							});
						}
					}
				},
				{
					content: "[0246.Highway] Selected node pins -> highway _query",
					callback: (value, options, evt, menu, node) => {
						for (let node_id in app.canvas.selected_nodes) {
							if (node.id === Number(node_id))
								continue;
							const query = node.widgets.find(w => w.name === "_query"),
								from = app.graph.getNodeById(Number(node_id));
							query.value = "";
							if (defs[from.comfyClass]?.input?.required)
								querify_input_pin(query, from, "required", ">");
							if (defs[from.comfyClass]?.input?.optional)
								querify_input_pin(query, from, "optional", ">");
							querify_output_pin(query, from, "<");
						}
					}
				},
				{
					content: "[0246.Highway] Selected node pins -> highway _query (inverse)",
					callback: (value, options, evt, menu, node) => {
						for (let node_id in app.canvas.selected_nodes) {
							if (node.id === Number(node_id))
								continue;
							const query = node.widgets.find(w => w.name === "_query"),
								from = app.graph.getNodeById(Number(node_id));
							query.value = "";
							if (defs[from.comfyClass]?.input?.required)
								querify_input_pin(query, from, "required", "<");
							if (defs[from.comfyClass]?.input?.optional)
								querify_input_pin(query, from, "optional", "<");
							querify_output_pin(query, from, ">");
						}
					}
				},
			);

			// HTML format of help
			help_option(nodeType, HELP["highway"], options);
			options.push(null);
		}, () => {});

		rgthree_exec("addConnectionLayoutSupport", nodeType, app);
	}

	function junction_impl(nodeType, nodeData, app, name, shape_in, shape_out) {
		nodeType.prototype.onNodeCreated = function () {
		
			init_type(this);
		
			if (typeof name === "string")
				init_update(this, name);

			const offset = this.widgets.find(w => w.name === "_offset");
			if (offset) {
				offset.options = offset.options ?? {};
				offset.options.multiline = true;
			}

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
						// node_fit(this.self, this.self.widgets.filter(_ => _.name === "_offset")[0]);
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
							// node_fit(this.self, this.self.widgets.filter(_ => _.name === "_offset")[0]);
						}
					} break;
				}
			});

			setup_expand(this, "output", real, "...", shape_out, function () {
				switch (this.mode) {
					case 0: {
						if (this.self.outputs[arguments[0]].links && this.self.outputs[arguments[0]].links.length > 0)
							return true;
						
						// Avoid node to connect to multiple output while allowing different pins
						for (let i = 0; i < this.self.outputs.length; ++ i) {
							if (BLACKLIST.includes(this.self.outputs[i].name))
								continue;
							let output_node = this.self.getOutputNodes(i);
							for (let j = 0; j < output_node.length; ++ j) {
								if (output_node[j] === arguments[3] && i === arguments[0])
									return false;
							}
						}

						if (arguments[2].__outputType) // Reroute
							this.self.outputs[arguments[0]].type = arguments[2].__outputType;
						// else if (arguments[2].defaultConnectionsLayout) // Reroute (rgthree)
						// 	this.self.outputs[arguments[0]].type = arguments[2].type;
						else
							this.self.outputs[arguments[0]].type = arguments[2].type;
					} break;
					case 1: {
						this.self.outputs[arguments[2]].name = `${arguments[1]}:${arguments[0]}`;
						// node_fit(this.self, this.self.widgets.filter(_ => _.name === "_offset")[0]);
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
								// node_fit(this.self, this.self.widgets.filter(_ => _.name === "_offset")[0]);
							}
						}
					} break;
				}
			});

			lib0246.hijack(this, "getExtraMenuOptions", function (canvas, options) {
				help_option(nodeType, HELP["junction"], options);
			}, () => {});
		};
		rgthree_exec("addConnectionLayoutSupport", nodeType, app);
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

	function single_impl_input(nodeType, nodeData, app, shape_in, pin_list) {
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
			if (node.widgets_values)
				node.widgets_values[index] = "";
			return "";
		};
	}

	function force_size(node, widget, mode) {
		let temp_size = node.computeSize();
		if (!node.size)
			node.size = temp_size;
		temp_size[0] = node.size[0];
		if (widget)
			temp_size[1] += widget.computedHeight - 32;
		if (mode)
			node.setSize(temp_size);
		else
			node.size = temp_size;
	}

	function setup_log(nodeType, history = false) {
		lib0246.hijack(nodeType.prototype, "onNodeCreated", () => {}, function () {
			raw_setup_log(this.self);
			if (history) {
				this.self.log_history = new lib0246.RingBuffer(30);
				this.self.log_count = 0;
			}
			const node = this.self;
			node.msgSize = function (event) {
				force_size(node, node.log_widget, false);
			};
			window.setTimeout(() => {
				// https://github.com/failfa-st/failfast-comfyui-extensions/issues/16
				api.addEventListener("ue-message-handler", node.msgSize);
				lib0246.hijack(node, "onRemoved", () => {}, function () {
					api.removeEventListener("ue-message-handler", node.msgSize);
				});
			}, 0);
		});
		lib0246.hijack(nodeType.prototype, "onExecuted", () => {}, function (message) {
			if (this.self.log_history) {
				this.self.log_history.push({
					track: this.self.log_count ++,
					msg: message.text
				});
				
				this.self.log_widget.value = "";
				for (let item of this.self.log_history)
					this.self.log_widget.value += `${item.track}: ` + item.msg + "\n\n";
			} else
				this.self.log_widget.value = message.text;
		});
	}

	function save_parse_load_pin(node, shape_in, shape_out, callback) {
		node.__update = true;

		let prev = [];

		// Save previous inputs and outputs
		if (node.inputs) {
			for (let i = 0; i < node.inputs.length; ++ i) {
				if (!BLACKLIST.includes(node.inputs[i].name) && node.inputs[i].link !== null)
					prev.push({
						flag: false,
						name: node.inputs[i].orig_name,
						node_id: app.graph.links[node.inputs[i].link].origin_id,
						slot_id: app.graph.links[node.inputs[i].link].origin_slot,
					});
			}

			for (let i = node.inputs.length; i -- > 0;) {
				if (!BLACKLIST.includes(node.inputs[i].name))
					node.removeInput(i);
			}

			callback(node, prev, false);

			for (let i = 0; i < node.inputs.length; ++ i) {
				node.inputs[i].orig_name = node.inputs[i].name;
				node.inputs[i].orig_type = node.inputs[i].type;
				if (!BLACKLIST.includes(node.inputs[i].name))
					node.inputs[i].shape = shape_in;
			}
		}

		if (node.outputs) {
			for (let i = 0; i < node.outputs.length; ++ i) {
				if (!BLACKLIST.includes(node.outputs[i].name) && node.outputs[i].links !== null)
					for (let j = 0; j < node.outputs[i].links.length; ++ j)
						prev.push({
							flag: true,
							name: node.outputs[i].orig_name,
							node_id: app.graph.links[node.outputs[i].links[j]].target_id,
							slot_id: app.graph.links[node.outputs[i].links[j]].target_slot,
						});
			}

			for (let i = node.outputs.length; i -- > 0;) {
				if (!BLACKLIST.includes(node.outputs[i].name))
					node.removeOutput(i);
			}

			callback(node, prev, true);

			for (let i = 0; i < node.outputs.length; ++ i) {
				node.outputs[i].orig_name = node.outputs[i].name;
				node.outputs[i].orig_type = node.outputs[i].type;
				if (!BLACKLIST.includes(node.outputs[i].name))
					node.outputs[i].shape = shape_out;
			}
		}

		// Restore previous inputs and outputs
		for (let i = 0; i < prev.length; ++ i) {
			// Check if input/output still exists
			if (prev[i].flag) {
				for (let j = 0; j < node.outputs.length; ++ j)
					if (node.outputs[j].orig_name.slice(0) === prev[i].name.slice(0)) {
						node.connect(
							j,
							prev[i].node_id,
							prev[i].slot_id
						);
						break;
					}
			} else {
				for (let j = 0; j < node.inputs.length; ++ j)
					if (node.inputs[j].orig_name.slice(1) === prev[i].name.slice(1)) {
						app.graph.getNodeById(prev[i].node_id).connect(
							prev[i].slot_id,
							node,
							j
						);
						break;
					}
			}
		}
	}

	function copy_input_pin(node, from, kind, to_kind, path, ops) {
		const kind_upper = to_kind.charAt(0).toUpperCase() + to_kind.slice(1);
		for (let name in defs[from.comfyClass][kind][path])
			node["add" + kind_upper](
				`${ops}${name}`,
				Array.isArray(defs[from.comfyClass][kind][path][name][0]) ?
					"STRING" : // COMBO is STRING internally anyways
					defs[from.comfyClass][kind][path][name][0]
			);
	}

	function querify_input_pin(widget, from, path, ops) {
		for (let name in defs[from.comfyClass].input[path])
			widget.value += `${ops}${name};`;
	}

	function copy_output_pin(node, from, kind, ops) {
		const kind_upper = kind.charAt(0).toUpperCase() + kind.slice(1);
		for (let i = 0; i < defs[from.comfyClass].output_name.length; ++ i)
			node["add" + kind_upper](
				`${ops}${defs[from.comfyClass].output_name[i]}`,
				Array.isArray(defs[from.comfyClass].output[i]) ?
					"STRING" :
					defs[from.comfyClass].output[i]
			);
	}

	function querify_output_pin(widget, from, ops) {
		for (let i = 0; i < defs[from.comfyClass].output_name.length; ++ i)
			widget.value += `${ops}${defs[from.comfyClass].output_name[i]};`;
	}

	function process_reroute(node, type) {
		type = type ?? node.widgets[0].value;
		node.size[0] = 100 + type.length * 8;
		node.inputs[0].type = type;
		node.outputs[0].type = type;
		node.__outputType = type;
	}

	function node_mouse_pos(node) {
		return [
			app.canvas.graph_mouse[0] - node.pos[0],
			app.canvas.graph_mouse[1] - node.pos[1],
		];
	}

	const FLEX_DB = new WeakMap();

	function calc_flex(node, widget, width, height) {
		node.flex_data = node.flex_data ?? {};
		node.flex_data.share_count = 0;
		node.flex_data.share_weight = [];
		node.flex_data.share_max_h = [];
		node.flex_data.share_real_h = 0;
		node.flex_data.off_h = 0;
		for (let i = 0; i < node.widgets.length; ++ i)
			if (node.widgets[i]?.flex) {
				node.flex_data.share_weight.push(node.widgets[i]?.flex?.share);
				node.flex_data.share_max_h.push(Number.isFinite(node.widgets[i]?.flex?.max_h) && node.widgets[i]?.flex?.max_h > 0 ? node.widgets[i]?.flex?.max_h : null);
				node.flex_data.share_real_h += node.widgets[i]?.flex?.real_h ?? 0;
				++ node.flex_data.share_count;
				if (node.widgets[i] === widget)
					node.widgets[i].flex.index = node.flex_data.share_count - 1;
			} else
				node.flex_data.off_h += (node.widgets[i]?.computedHeight ?? node.widgets[i]?.computeSize?.(width)?.[1] ?? LiteGraph.NODE_WIDGET_HEIGHT) + 4;
		node.flex_data.avail_h = height - node.flex_data.off_h;
	}

	function widget_flex(node, widget, options = {}) {
		widget.flex = {};

		lib0246.hijack(widget, "mouse", function (event, pos, evt_node) {
			if (evt_node !== node) {
				// [TODO] Figure out why this does not work
				// this.self.flex.hold_mouse[0] = this.self.flex.margin_x;
				// this.self.flex.hold_mouse[1] = this.self.flex.real_y - 2;
				// this.self.flex.hold_mouse[2] = this.self.flex.real_w - this.self.flex.margin_x * 2;
				// this.self.flex.hold_mouse[3] = this.self.flex.temp_h - 2;
				this.self.flex.hold_mouse = this.self.flex.hold_draw;
			} else
				lib0246.calc_area(
					this.self.flex.margin_x, this.self.flex.margin_head_y, this.self.flex.margin_tail_real_y,
					this.self.flex.real_w, this.self.flex.real_h, this.self.flex.real_max_h,
					this.self.flex.ratio, this.self.flex.center, (this.self.flex.real_y ?? 0),
					true, this.self.flex.hold_mouse
				);
		}, () => {});

		lib0246.hijack(widget, "draw", function (ctx, draw_node, widget_width, y, widget_height) {
			this.self.flex.real_y = y;
			this.self.flex.real_w = widget_width;

			if (draw_node !== node) {
				this.self.flex.hold_draw[0] = this.self.flex.margin_x;
				this.self.flex.hold_draw[1] = this.self.flex.real_y - 2;
				this.self.flex.hold_draw[2] = widget_width - this.self.flex.margin_x * 2;
				this.self.flex.hold_draw[3] = this.self.flex.temp_h - 2;
			} else
				lib0246.calc_area(
					this.self.flex.margin_x, this.self.flex.margin_head_y, this.self.flex.margin_tail_real_y,
					widget_width, this.self.flex.real_h, this.self.flex.real_max_h,
					this.self.flex.ratio, this.self.flex.center, this.self.flex.real_y,
					true, this.self.flex.hold_draw
				);
		}, () => {});

		lib0246.hijack(widget, "computeSize", function (width) {
			if (PROCESS_WIDGET_NODE && PROCESS_WIDGET_NODE !== node && PROCESS_WIDGET_NODE.isPointInside(app.canvas.graph_mouse[0], app.canvas.graph_mouse[1])) {
				// [TODO] Maybe somehow find a way to use hold_size since it technically more correct
				this.res = [width, this.self.flex.hold_draw[3]];
				this.self.last_y = this.self.flex.real_y + this.self.flex.margin_head_y;
				this.stop = true;
				return;
			}

			// Don't ask why how I came up with this. This took a week of brain power.

			this.self.flex.real_y = this.self.flex.real_y ?? 0;
			this.self.flex.margin_tail_real_y = this.self.flex.margin_tail_y + this.self.flex.margin_over_y;

			this.self.flex.real_max_h = Infinity;

			this.self.flex.real_min_h = this.self.flex.real_min_h ?? this.self.flex.min_h;

			let raw_size = node.size[1];

			if (app.canvas.resizing_node === node)
				raw_size = Math.min(node_mouse_pos(node)[1], node.size[1]);

			calc_flex(node, this.self, width, raw_size);

			this.self.flex.real_h = node.flex_data.avail_h + node.flex_data.off_h; // (LiteGraph.NODE_WIDGET_HEIGHT + 4) * (node.flex_data.share_count + 1)

			this.self.flex.real_max_h = lib0246.calc_spread(
				node.flex_data.share_count,
				node.flex_data.avail_h,
				node.flex_data.share_weight,
				node.flex_data.share_max_h
			)[this.self.flex.index];

			lib0246.calc_area(
				this.self.flex.margin_x, this.self.flex.margin_head_y, this.self.flex.margin_tail_real_y,
				width, this.self.flex.real_h, this.self.flex.real_max_h,
				this.self.flex.ratio, this.self.flex.center, this.self.flex.real_y,
				true, this.self.flex.hold_size
			);

			this.self.flex.temp_h = this.self.flex.hold_size[3]; // + this.self.flex.margin_head_y + this.self.flex.margin_tail_y;
			
			if (this.self.flex.real_h < this.self.flex.real_min_h)
				this.self.flex.real_h = this.self.flex.real_min_h;
			
			if (this.self.flex.temp_h < this.self.flex.real_min_h)
				this.self.flex.temp_h = this.self.flex.real_min_h;

			this.res = [width, this.self.flex.temp_h];
			this.stop = true;
		}, () => {});

		if (!FLEX_DB.has(node)) {
			lib0246.hijack(node, "onRemoved", () => {}, function () {
				for (let i = 0; i < node.widgets.length; ++ i) {
					if (node.widgets[i]?.flex)
						delete node.widgets[i].flex;
					delete node.widgets[i];
				}
				FLEX_DB.delete(node);
			});
		}

		widget.flex.hold_draw = [];
		widget.flex.hold_mouse = [];
		widget.flex.hold_size = [];

		widget.flex.margin_x = options.margin_x ?? 20;
		widget.flex.margin_head_y = options.margin_head_y ?? 0;
		widget.flex.margin_tail_y = options.margin_tail_y ?? 0;
		widget.flex.margin_over_y = options.margin_over_y ?? 12
		widget.flex.min_h = options.min_h ?? 0;
		widget.flex.max_h = options.max_h ?? Infinity;
		widget.flex.compat = options.compat ?? false;
		widget.flex.ratio = options.ratio ?? 0;
		widget.flex.share = options.share ?? false;
		widget.flex.center = options.center ?? true;

		widget.options = widget.options ?? {};
		widget.options.getHeight = function () {
			return this.self.flex.real_h;
		};

		FLEX_DB.set(node, false);
	}

	function box_range_eval_state(db, node, widget, event, pos) {
		for (let i = 0; i < db.length; i += 2) {
			if (Array.isArray(db[i])) {
				for (let j = 0; j < db[i].length; ++ j)
					if (lib0246.equal_dict(widget.box_range.state, db[i][j], true, "*")) {
						lib0246.update_dict(widget.box_range.state, db[i + 1](node, widget, event, pos) ?? {});
						return;
					}
				continue;
			} else if (lib0246.equal_dict(widget.box_range.state, db[i], true, "*")) {
				lib0246.update_dict(widget.box_range.state, db[i + 1](node, widget, event, pos) ?? {});
				return;
			}
		}
	}

	function box_range_eval_corner(pos, curr_box, widget) {
		if (lib0246.is_inside_circ(
			pos[0], pos[1],
			curr_box[8] + curr_box[10], curr_box[9], widget.box_range.radius
		)) {
			// Intentionally prioritize top right
			widget.box_range.state.where = "tr";
			return true;
		} else if (lib0246.is_inside_circ(
			pos[0], pos[1],
			curr_box[8], curr_box[9], widget.box_range.radius
		)) {
			widget.box_range.state.where = "tl";
			return true;
		} else if (lib0246.is_inside_circ(
			pos[0], pos[1],
			curr_box[8], curr_box[9] + curr_box[11], widget.box_range.radius
		)) {
			widget.box_range.state.where = "bl";
			return true;
		} else if (lib0246.is_inside_circ(
			pos[0], pos[1],
			curr_box[8] + curr_box[10], curr_box[9] + curr_box[11], widget.box_range.radius
		)) {
			widget.box_range.state.where = "br";
			return true;
		}
		return false;
	}

	function box_range_reset_state(widget) {
		delete widget.box_range.state.mouse;
		delete widget.box_range.state.where;
		delete widget.box_range.state.action;
		delete widget.box_range.state.select;
		delete widget.box_range.state.bound;
	}

	function box_range_process_del(widget) {
		let index = widget.box_range.boxes.indexOf(widget.box_range.select[widget.box_range.select.length - 1]);
		if (index !== -1)
			widget.box_range.boxes.splice(index, 1);
		widget.box_range.select.length = 0;
		widget.box_range.delay_state = null;
	}

	function box_range_grid_snap(pos, widget) {
		pos[0] = lib0246.lerp(
			lib0246.snap(
				lib0246.norm(pos[0], widget.flex.hold_mouse[0], widget.flex.hold_mouse[0] + widget.flex.hold_mouse[2]) + 1 / (widget.row_count * 2),
				1 / widget.row_count
			),
			widget.flex.hold_mouse[0], widget.flex.hold_mouse[0] + widget.flex.hold_mouse[2]
		);
		pos[1] = lib0246.lerp(
			lib0246.snap(
				lib0246.norm(pos[1], widget.flex.hold_mouse[1], widget.flex.hold_mouse[1] + widget.flex.hold_mouse[3]) + 1 / (widget.col_count * 2),
				1 / widget.col_count
			),
			widget.flex.hold_mouse[1], widget.flex.hold_mouse[1] + widget.flex.hold_mouse[3]
		);
	}

	const BOX_RANGE_STATE = [
		// Selection
		...[
			[
				{
					mouse: "pointerdown",
					where: "box",
					action: "",
					bound: "in"
				}, {
					mouse: "pointerdown",
					where: "box",
					action: "select",
					bound: "in"
				},
			], function (node, widget, event, pos) {
				widget.box_range.select_during = pos;
				widget.box_range.delay_state = window.performance.now();
				return {
					action: "select"
				};
			},

			[
				{
					mouse: "pointerup",
					where: "box",
					action: "select",
					bound: "in"
				}
			], function (node, widget, event, pos) {
				// [TODO] Maybe also perform delete for this state?
				let res;
				if (lib0246.equal_array(widget.box_range.select_during, pos, false)) {
					if (event.shiftKey && widget.box_range.select.length > 0) {
						let curr_box = widget.box_range.select[widget.box_range.select.length - 1];
						app.canvas.prompt("[x, y, width, height]", JSON.stringify(curr_box.slice(0, 4)), (value) => {
							try {
								const res = JSON.parse(value);
								if (res.length !== 4)
									return;
								for (let i = 0; i < 4; ++ i)
									if (typeof res[i] === "string") {
										try {
											const BOUND_X = widget.flex.hold_mouse[0],
												BOUND_Y = widget.flex.hold_mouse[1],
												BOUND_W = widget.flex.hold_mouse[2],
												BOUND_H = widget.flex.hold_mouse[3];
											res[i] = Number(eval(res[i]));
										} catch (e) {
											lib0246.error_popup("Invalid box range math expression format.");
											return;
										}
									} else if (!Number.isFinite(res[i]))
										res[i] = widget.flex.hold_mouse[i];
								if (lib0246.is_inside_rect_rect(
									res[0], res[1], res[2], res[3],
									widget.flex.hold_draw[0], widget.flex.hold_draw[1],
									widget.flex.hold_draw[2], widget.flex.hold_draw[3]
								)) {
									curr_box[0] = res[0];
									curr_box[1] = res[1];
									curr_box[2] = res[2];
									curr_box[3] = res[3];
								} else
									lib0246.error_popup("Provided range is outside of the boundary.");
							} catch (e) {
								const ratio_widget = node.widgets.find(w => w.name === "box_ratio");
								let size_box = curr_box.slice(4, 8);
								if (ratio_widget)
									size_box = [0, 0, ratio_widget.value.data.width, ratio_widget.value.data.height];
								try {
									let old_onmessage = window.onmessage;
									window.onmessage = () => {};
									lib0246.safe_eval(`
										function _ (x, y, w, h) {
											return calc_flex_norm(
												x, y, w, h,
												${size_box[0]}, ${size_box[1]}, ${size_box[2]}, ${size_box[3]},
												${widget.flex.hold_draw[0]}, ${widget.flex.hold_draw[1]},
												${widget.flex.hold_draw[2]}, ${widget.flex.hold_draw[3]}
											);
										}

										const CURR_X = ${size_box[0]},
											CURR_Y = ${size_box[1]},
											CURR_W = ${size_box[2]},
											CURR_H = ${size_box[3]},
											CODE = ${"`" + value + "`"};

										return ${value};
									`).then((res) => {
										if (!Array.isArray(res) || res.length !== 4) {
											lib0246.error_popup("Invalid box range data format. Expected [x, y, width, height].");
											return;
										}
										if (lib0246.is_inside_rect_rect(
											res[0], res[1], res[2], res[3],
											widget.flex.hold_draw[0], widget.flex.hold_draw[1],
											widget.flex.hold_draw[2], widget.flex.hold_draw[3]
										)) {
											curr_box[0] = res[0];
											curr_box[1] = res[1];
											curr_box[2] = res[2];
											curr_box[3] = res[3];

											curr_box[12] = res[0];
											curr_box[13] = res[1];
											curr_box[14] = res[2];
											curr_box[15] = res[3];

											curr_box[16] = size_box[0];
											curr_box[17] = size_box[1];
											curr_box[18] = size_box[2];
											curr_box[19] = size_box[3];
										} else
											lib0246.error_popup("Provided range is outside of the boundary.");
										window.onmessage = old_onmessage;
										app.canvas.setDirty(true);
									});
								} catch (e) {
									lib0246.error_popup(`Invalid box range expression format: ${e.message}`);
									return;
								}
							}
						}, event, true);
						res = {
							action: ""
						};
					} else {
						let select_list = [];
						for (let i = 0; i < widget.box_range.boxes.length; ++ i)
							if (lib0246.is_inside_rect(
								pos[0], pos[1],
								widget.box_range.boxes[i][8], widget.box_range.boxes[i][9],
								widget.box_range.boxes[i][10], widget.box_range.boxes[i][11]
							))
								select_list.push(widget.box_range.boxes[i]);

						if (lib0246.equal_array(widget.box_range.select, select_list, true))
							widget.box_range.select.push(widget.box_range.select.shift());
						else
							widget.box_range.select = select_list;
					}
				}
				widget.box_range.select_during = null;
				widget.box_range.delay_state = null;
				return res;
			}
		],

		
		// Box create
		...[
			[
				{
					mouse: "pointerdown",
					where: "",
					action: "",
					bound: "in"
				}, {
					mouse: "pointerdown",
					where: "",
					action: "select",
					bound: "in"
				}
			], function (node, widget, event, pos) {
				widget.box_range.begin_state = pos;
				widget.box_range.during_state = pos;
				widget.box_range.select.length = 0;
				widget.box_range.delay_state = null;
				return {
					action: "create"
				};
			},

			{
				mouse: "pointerup",
				where: "",
				action: "",
				bound: "in"
			}, function (node, widget, event, pos) {
				widget.box_range.select.length = 0;
				return {
					action: ""
				};
			},

			{
				mouse: "pointermove",
				action: "create",
				bound: "in"
			}, function (node, widget, event, pos) {
				widget.box_range.during_state = pos;
			},

			{
				mouse: "pointerup",
				action: "create",
				bound: "in"
			}, function (node, widget, event, pos) {
				widget.box_range.during_state = pos;

				// Check if equal then terminate early
				if (!lib0246.equal_array(widget.box_range.begin_state, widget.box_range.during_state, false)) {
					if (widget.box_range.begin_state[0] > widget.box_range.during_state[0]) {
						let temp = widget.box_range.begin_state[0];
						widget.box_range.begin_state[0] = widget.box_range.during_state[0];
						widget.box_range.during_state[0] = temp;
					}
					if (widget.box_range.begin_state[1] > widget.box_range.during_state[1]) {
						let temp = widget.box_range.begin_state[1];
						widget.box_range.begin_state[1] = widget.box_range.during_state[1];
						widget.box_range.during_state[1] = temp;
					}

					const width = Math.abs(widget.box_range.during_state[0] - widget.box_range.begin_state[0]),
						height = Math.abs(widget.box_range.during_state[1] - widget.box_range.begin_state[1]);

					if (event.shiftKey) {
						let old_length = widget.box_range.boxes.length;
						for (let i = 0; i < old_length; ++ i)
							if (lib0246.is_inside_rect_rect(
								widget.box_range.boxes[i][0], widget.box_range.boxes[i][1],
								widget.box_range.boxes[i][2], widget.box_range.boxes[i][3],
								widget.box_range.begin_state[0], widget.box_range.begin_state[1],
								width, height
							)) {
								widget.box_range.select.push(widget.box_range.boxes[i]);
								widget.box_range.boxes.splice(i --, 1);
								-- old_length;
							}
						widget.box_range.select.length = 0;
					} else
						widget.box_range.boxes.push([
							widget.box_range.begin_state[0],
							widget.box_range.begin_state[1],
							width, height,
							...widget.flex.hold_mouse,
							widget.box_range.begin_state[0],
							widget.box_range.begin_state[1],
							width, height,
						]);
				}

				widget.box_range.begin_state = null;
				widget.box_range.during_state = null;
				return {
					action: ""
				};
			},
		],

		// Box move
		...[
			[
				{
					mouse: "pointermove",
					where: "box",
					action: "select",
					bound: "in"
				}
			], function (node, widget, event, pos) {
				if (event.shiftKey)
					box_range_grid_snap(pos, widget);
				widget.box_range.begin_state = pos;
				widget.box_range.during_state = pos;
				widget.box_range.delay_state = null;

				if (widget.box_range.select.length === 0)
					return {
						action: "select"
					};
				return {
					action: "move"
				};
			},

			{
				mouse: "pointermove",
				action: "move",
				bound: "in"
			}, function (node, widget, event, pos) {
				widget.box_range.during_state = pos;
				if (event.shiftKey) {
					box_range_grid_snap(widget.box_range.begin_state, widget);
					box_range_grid_snap(widget.box_range.during_state, widget);
				}
			},

			{
				mouse: "pointerup",
				action: "move",
				bound: "in"
			}, function (node, widget, event, pos) {
				const curr_box = widget.box_range.select[widget.box_range.select.length - 1],
					res = lib0246.calc_flex_norm(
						curr_box[0], curr_box[1], curr_box[2], curr_box[3],
						curr_box[4], curr_box[5], curr_box[6], curr_box[7],
						widget.flex.hold_mouse[0], widget.flex.hold_mouse[1], widget.flex.hold_mouse[2], widget.flex.hold_mouse[3],
					);

				let new_x = res[0] + widget.box_range.during_state[0] - widget.box_range.begin_state[0],
					new_y = res[1] + widget.box_range.during_state[1] - widget.box_range.begin_state[1];
				
				if (!lib0246.is_inside_rect_rect(
					new_x, new_y, res[2], res[3],
					widget.flex.hold_mouse[0], widget.flex.hold_mouse[1],
					widget.flex.hold_mouse[2], widget.flex.hold_mouse[3]
				)) {
					// Champ back to range with a combination of min and max
					new_x = Math.max(
						Math.min(new_x, widget.flex.hold_mouse[0] + widget.flex.hold_mouse[2] - res[2]),
						widget.flex.hold_mouse[0]
					);
					new_y = Math.max(
						Math.min(new_y, widget.flex.hold_mouse[1] + widget.flex.hold_mouse[3] - res[3]),
						widget.flex.hold_mouse[1]
					);
				}

				curr_box[0] = res[0];
				curr_box[1] = res[1];
				curr_box[2] = res[2];
				curr_box[3] = res[3];
				
				curr_box[4] = widget.flex.hold_mouse[0];
				curr_box[5] = widget.flex.hold_mouse[1];
				curr_box[6] = widget.flex.hold_mouse[2];
				curr_box[7] = widget.flex.hold_mouse[3];

				curr_box[8] = curr_box[0];
				curr_box[9] = curr_box[1];
				curr_box[10] = curr_box[2];
				curr_box[11] = curr_box[3];

				curr_box[0] = new_x;
				curr_box[1] = new_y;

				curr_box[8] = new_x
				curr_box[9] = new_y;

				widget.box_range.begin_state = null;
				widget.box_range.during_state = null;
				return {
					action: "select"
				};
			},

			{
				mouse: "pointerup",
				action: "move",
				bound: "out"
			}, function (node, widget, event, pos) {
				widget.box_range.begin_state = null;
				widget.box_range.during_state = null;
				widget.box_range.select.length = 0;
				return {
					action: ""
				};
			}
		],

		// Box resize
		...[
			{
				mouse: "pointerdown",
				where: "br",
				action: "select",
				bound: "in"
			}, function (node, widget, event, pos) {
				if (!widget.box_range.delay_state)
					widget.box_range.delay_state = window.performance.now();
				else if (window.performance.now() - widget.box_range.delay_state < widget.box_range.delay_dbl) {
					if (event.shiftKey)
						box_range_grid_snap(pos, widget);
					widget.box_range.begin_state = pos;
					widget.box_range.during_state = pos;
					widget.box_range.delay_state = null;
					return {
						action: "resize"
					};
				}
			},

			[
				{
					mouse: "pointermove",
					action: "resize",
					bound: "in"
				},
			], function (node, widget, event, pos) {
				if (!pos) return;
				widget.box_range.during_state = pos;
				if (event.shiftKey) {
					box_range_grid_snap(widget.box_range.begin_state, widget);
					box_range_grid_snap(widget.box_range.during_state, widget);
				}
			},

			{
				mouse: "pointerup",
				action: "resize",
				bound: "in"
			}, function (node, widget, event, pos) {
				if (!lib0246.equal_array(widget.box_range.during_state, widget.box_range.begin_state, false)) {
					const curr_box = widget.box_range.select[widget.box_range.select.length - 1];

					let res = lib0246.calc_flex_norm(
						curr_box[0], curr_box[1], curr_box[2], curr_box[3],
						curr_box[4], curr_box[5], curr_box[6], curr_box[7],
						widget.flex.hold_mouse[0], widget.flex.hold_mouse[1], widget.flex.hold_mouse[2], widget.flex.hold_mouse[3],
					);
					
					res = lib0246.calc_resize(
						res[0], res[1], res[2], res[3],
						widget.box_range.during_state[0], widget.box_range.during_state[1]
					);

					curr_box[0] = res[0];
					curr_box[1] = res[1];
					curr_box[2] = res[2];
					curr_box[3] = res[3];

					curr_box[4] = widget.flex.hold_mouse[0];
					curr_box[5] = widget.flex.hold_mouse[1];
					curr_box[6] = widget.flex.hold_mouse[2];
					curr_box[7] = widget.flex.hold_mouse[3];

					curr_box[8] = curr_box[0];
					curr_box[9] = curr_box[1];
					curr_box[10] = curr_box[2];
					curr_box[11] = curr_box[3];

					// Remove index 12 to index 19
					curr_box.splice(12, 8);
				}

				widget.box_range.begin_state = null;
				widget.box_range.during_state = null;
				return {
					action: "select"
				};
			},
			
			{
				mouse: "pointerup",
				bound: "in",
				where: "br",
				action: "select"
			}, () => {},

			{
				mouse: "pointerup",
				action: "resize",
				bound: "out"
			}, function (node, widget, event, pos) {
				widget.box_range.begin_state = null;
				widget.box_range.during_state = null;
				widget.box_range.select.length = 0;
				return {
					action: ""
				};
			}
		],

		// Box z-index
		...[
			[
				{
					mouse: "pointerdown",
					where: "tl",
					action: "select",
					bound: "in"
				}, {
					mouse: "pointerdown",
					where: "bl",
					action: "select",
					bound: "in"
				}
			], function (node, widget, event, pos) {
				if (!widget.box_range.delay_state)
					widget.box_range.delay_state = window.performance.now();
				else if (window.performance.now() - widget.box_range.delay_state < widget.box_range.delay_dbl) {
					const curr_index = widget.box_range.boxes.indexOf(widget.box_range.select[widget.box_range.select.length - 1]);

					// Insert box to curr_index + 1 if state.where is bottom left, else curr_index - 1
					widget.box_range.boxes.splice(
						lib0246.rem(widget.box_range.state.where === "bl" ? curr_index + 1 : curr_index - 1, widget.box_range.boxes.length),
						0,
						widget.box_range.boxes.splice(curr_index, 1)[0]
					);

					widget.box_range.delay_state = null;

					return {
						action: "select"
					};
				}
			},

			[
				{
					mouse: "pointerup",
					where: "tl",
					action: "select",
					bound: "in"
				}, {
					mouse: "pointerup",
					where: "bl",
					action: "select",
					bound: "in"
				}
			], () => {}
		],
		
		// Box delete
		...[
			{
				mouse: "pointerdown",
				where: "tr",
				action: "select",
				bound: "in"
			}, function (node, widget, event, pos) {
				if (!widget.box_range.delay_state)
					widget.box_range.delay_state = window.performance.now();
				else if (window.performance.now() - widget.box_range.delay_state < widget.box_range.delay_dbl) {
					box_range_process_del(widget);
					return {
						action: ""
					};
				}
			},

			{
				mouse: "pointerup",
				where: "tr",
				action: "select",
				bound: "in"
			}, () => {},
		],

		// Reset state if invalid
		{}, function (node, widget, event, pos) {
			box_range_reset_state(widget);
			widget.box_range.select.length = 0;
			widget.box_range.begin_state = null;
			widget.box_range.during_state = null;
			widget.box_range.select_during = null;
			widget.box_range.delay_state = null;
		}
	];

	const NODE_COLOR_LIST = Object.keys(LGraphCanvas.node_colors);

	function BOX_RANGE_WIDGET(node, data_type, data_name, options = {}) {
		const widget = {
			type: data_type,
			name: data_name,
			get value() {
				let data = [];

				for (let i = 0; i < this.box_range.boxes.length; ++ i)
					data.push(lib0246.calc_flex_norm(
						this.box_range.boxes[i][0], this.box_range.boxes[i][1], this.box_range.boxes[i][2], this.box_range.boxes[i][3],
						this.box_range.boxes[i][4], this.box_range.boxes[i][5], this.box_range.boxes[i][6], this.box_range.boxes[i][7],
						this.flex.hold_draw[0], this.flex.hold_draw[1], this.flex.hold_draw[2], this.flex.hold_draw[3]
					));

				return {
					type: "box_range",
					data: data,
					area: [
						this.flex.hold_draw[0], this.flex.hold_draw[1],
						this.flex.hold_draw[2], this.flex.hold_draw[3]
					],
					flag: this.flex.ratio === 0
				};
			},
			set value(v) {
				if (v.flag)
					this.flex.ratio = 0;
				else
					this.flex.ratio = v.area[2] / v.area[3];

				this.box_range.boxes.length = 0;

				for (let i = 0; i < v.data.length; ++ i)
					this.box_range.boxes.push([
						...v.data[i],
						...v.area,
						...v.data[i],
					]);
			},
			draw: function (ctx, node, widget_width, y, widget_height) {
				ctx.save();

				ctx.beginPath();
				ctx.strokeStyle = "#000000";
				ctx.fillStyle = app.canvas.clear_background_color;
				ctx.lineWidth = 2;
				ctx.beginPath();
				ctx.rect(this.flex.hold_draw[0], this.flex.hold_draw[1], this.flex.hold_draw[2], this.flex.hold_draw[3]);
				ctx.stroke();
				ctx.fill();
				ctx.closePath();

				// Draw evenly spaced grid of both row and column of specified count
				ctx.beginPath();
				ctx.strokeStyle = "#000000";
				ctx.lineWidth = 1;
				ctx.lineWidth = 0.5;
				ctx.setLineDash([10, 5]);
				for (let i = 0; i < this.row_count; ++ i) {
					ctx.moveTo(this.flex.hold_draw[0], i * this.flex.hold_draw[3] / this.row_count + this.flex.hold_draw[1]);
					ctx.lineTo(this.flex.hold_draw[2] + this.flex.hold_draw[0], i * this.flex.hold_draw[3] / this.row_count + this.flex.hold_draw[1]);
					ctx.stroke();
				}
				for (let i = 0; i < this.col_count; ++ i) {
					ctx.moveTo(i * this.flex.hold_draw[2] / this.col_count + this.flex.hold_draw[0], this.flex.hold_draw[1]);
					ctx.lineTo(i * this.flex.hold_draw[2] / this.col_count + this.flex.hold_draw[0], this.flex.hold_draw[3] + this.flex.hold_draw[1]);
					ctx.stroke();
				}
				ctx.closePath();

				// Map each point to fit the grid by percentage based on previous size to current size
				if (this?.box_range?.boxes)
					for (let i = 0; i < this.box_range.boxes.length; ++ i) {
						let curr = this.box_range.boxes[i];
						const res = lib0246.calc_flex_norm(
							curr[0], curr[1], curr[2], curr[3],
							curr[4], curr[5], curr[6], curr[7],
							this.flex.hold_draw[0], this.flex.hold_draw[1], this.flex.hold_draw[2], this.flex.hold_draw[3]
						);
						curr[8] = res[0];
						curr[9] = res[1];
						curr[10] = res[2];
						curr[11] = res[3];
					}

				// Draw each box
				if (this?.box_range?.boxes) {
					for (let i = 0; i < this.box_range.boxes.length; ++ i) {
						let curr = this.box_range.boxes[i];

						if (this.box_range.boxes[i] === this.box_range.select[this.box_range.select.length - 1]) {
							// Draw text metadata bottom left of the entire grid
							ctx.beginPath();
							ctx.fillStyle = "#ffffff";
							ctx.font = "12px Consolas";
							ctx.fillText(
								// `%XY2: (${lib0246.floor(lib0246.norm(curr[8] + curr[10], this.flex.hold_draw[0], this.flex.hold_draw[2]), 2)}, ${lib0246.floor(lib0246.norm(curr[9] + curr[11], this.flex.hold_draw[1], this.flex.hold_draw[3]), 2)})`,
								`%WH: (${lib0246.floor(curr[10] / this.flex.hold_draw[2], 2)}, ${lib0246.floor(curr[11] / this.flex.hold_draw[3], 2)})`,
								this.flex.hold_draw[0] + 5, this.flex.hold_draw[3] + this.flex.hold_draw[1] - 5
							);
							ctx.fillText(
								`%XY: (${lib0246.floor(lib0246.norm(curr[0], this.flex.hold_draw[0], this.flex.hold_draw[2]), 2)}, ${lib0246.floor(lib0246.norm(curr[1], this.flex.hold_draw[1], this.flex.hold_draw[3]), 2)})`,
								this.flex.hold_draw[0] + 5, this.flex.hold_draw[3] + this.flex.hold_draw[1] - 20
							);
							ctx.fillText(
								`Z: ${i}`,
								this.flex.hold_draw[0] + 5, this.flex.hold_draw[3] + this.flex.hold_draw[1] - 35
							);
							ctx.fillText(
								`WH: (${lib0246.floor(curr[10], 2)}, ${lib0246.floor(curr[11], 2)})`,
								this.flex.hold_draw[0] + 5, this.flex.hold_draw[3] + this.flex.hold_draw[1] - 50
							);
							ctx.fillText(
								`XY: (${lib0246.floor(curr[8], 2)}, ${lib0246.floor(curr[9], 2)})`,
								this.flex.hold_draw[0] + 5, this.flex.hold_draw[3] + this.flex.hold_draw[1] - 65
							);
							ctx.closePath();

							// Draw 4 circles for each corner
							ctx.beginPath();
							ctx.lineWidth = 1;
							ctx.strokeStyle = "#ff7ac1";
							ctx.setLineDash([]);
							ctx.arc(curr[8], curr[9], this.box_range.radius, 0, Math.PI * 2);
							ctx.stroke();
							ctx.closePath();
							ctx.beginPath();
							ctx.strokeStyle = "#800044";
							ctx.arc(curr[8], curr[9] + curr[11], this.box_range.radius, 0, Math.PI * 2);
							ctx.stroke();
							ctx.closePath();

							// Delete
							ctx.beginPath();
							ctx.lineWidth = 1;
							ctx.strokeStyle = "#ff0000";
							ctx.arc(curr[8] + curr[10], curr[9], this.box_range.radius, 0, Math.PI * 2);
							ctx.stroke();
							ctx.closePath();

							// Resize
							ctx.beginPath();
							ctx.strokeStyle = "#ffff00";
							ctx.arc(curr[8] + curr[10], curr[9] + curr[11], this.box_range.radius, 0, Math.PI * 2);
							ctx.stroke();
							ctx.closePath();
						}

						ctx.beginPath();
						ctx.fillStyle = "rgba(127, 127, 127, 0.1)";
						if (this.box_range.select.length > 0 && this.box_range.select.indexOf(this.box_range.boxes[i]) === this.box_range.select.length - 1) {
							ctx.lineWidth = 1.5;
							ctx.strokeStyle = "#ff0000";
							ctx.setLineDash([5, 5]);
						} else {
							ctx.lineWidth = 1;
							ctx.strokeStyle = "#ffffff";
							ctx.setLineDash([]);
						}
						ctx.rect(curr[8], curr[9], curr[10], curr[11]);
						ctx.stroke();
						ctx.fill();
						ctx.closePath();
					}

					for (let i = 0; i < this.box_range.boxes.length; ++ i) {
						let curr = this.box_range.boxes[i];

						// Draw index text starting from the box top left
						ctx.beginPath();
						ctx.fillStyle = LGraphCanvas.node_colors[NODE_COLOR_LIST[i % NODE_COLOR_LIST.length]].groupcolor;
						ctx.font = "15px Consolas";
						ctx.fillText(
							`${i}`,
							curr[8] + 5, curr[9] + 15
						);
						ctx.closePath();
					}
				}

				// Draw ghost movement
				if (this?.box_range?.begin_state && this?.box_range?.during_state) {
					ctx.beginPath();
					ctx.lineWidth = 3;
					ctx.setLineDash([5, 5]);
					ctx.moveTo(this.box_range.begin_state[0], this.box_range.begin_state[1]);
					let last_select = this.box_range.select[this.box_range.select.length - 1] ?? [];

					switch (this.box_range.state.action) {
						case "create": {
							ctx.strokeStyle = "rgba(0, 255, 0, 0.75)";
							ctx.rect(
								this.box_range.begin_state[0], this.box_range.begin_state[1],
								this.box_range.during_state[0] - this.box_range.begin_state[0], this.box_range.during_state[1] - this.box_range.begin_state[1],
							);
						} break;
						case "resize": {
							ctx.strokeStyle = "rgba(255, 255, 0, 0.75)";
							const res = lib0246.calc_resize(
								last_select[8], last_select[9], last_select[10], last_select[11],
								this.box_range.during_state[0], this.box_range.during_state[1]
							);
							ctx.rect(res[0], res[1], res[2], res[3]);
						} break;
						case "move": {
							ctx.strokeStyle = "rgba(0, 0, 255, 0.75)";
							ctx.rect(
								last_select[8] + this.box_range.during_state[0] - this.box_range.begin_state[0],
								last_select[9] + this.box_range.during_state[1] - this.box_range.begin_state[1],
								last_select[10], last_select[11]
							);
						}
					}

					ctx.stroke();
					ctx.closePath();

					ctx.beginPath();
					ctx.fillStyle = "#ffffff";
					ctx.font = "12px Consolas";
					ctx.fillText(
						`!XY: (${lib0246.floor(this.box_range.during_state[0], 2)}, ${lib0246.floor(this.box_range.during_state[1], 2)})`,
						this.flex.hold_draw[0] + 5, this.flex.hold_draw[1] + 15
					);
					ctx.closePath();
				}

				ctx.restore();
			},
			mouse: function (event, pos, node) {
				// if (pos[0] < this.flex.hold_mouse[0])
				// 	pos[0] = this.flex.hold_mouse[0];
				// if (pos[1] < this.flex.hold_mouse[1])
				// 	pos[1] = this.flex.hold_mouse[1];
				// if (pos[0] > this.flex.hold_mouse[2] + this.flex.hold_mouse[0])
				// 	pos[0] = this.flex.hold_mouse[2] + this.flex.hold_mouse[0];
				// if (pos[1] > this.flex.hold_mouse[3] + this.flex.hold_mouse[1])
				// 	pos[1] = this.flex.hold_mouse[3] + this.flex.hold_mouse[1];
				
				widget.box_range.state = widget.box_range.state ?? {};
				widget.box_range.delay_state = widget.box_range.delay_state ?? null;
				
				widget.box_range.state.mouse = event.type;

				let box_flag = false;
				if (widget.box_range.select.length > 0)
					if (box_range_eval_corner(pos, widget.box_range.select[widget.box_range.select.length - 1], widget))
						box_flag = true;
					else if (lib0246.is_inside_rect(
						pos[0], pos[1],
						widget.box_range.select[widget.box_range.select.length - 1][8], widget.box_range.select[widget.box_range.select.length - 1][9],
						widget.box_range.select[widget.box_range.select.length - 1][10], widget.box_range.select[widget.box_range.select.length - 1][11]
					)) {
						widget.box_range.state.where = "box";
						box_flag = true;
					}
				
				if (!box_flag)
					for (let i = 0; i < widget.box_range.boxes.length; ++ i)
						if (lib0246.is_inside_rect(
							pos[0], pos[1],
							widget.box_range.boxes[i][8], widget.box_range.boxes[i][9],
							widget.box_range.boxes[i][10], widget.box_range.boxes[i][11]
						)) {
							widget.box_range.state.where = "box";
							box_flag = true;
							break;
						} else if (box_range_eval_corner(pos, widget.box_range.boxes[i], widget)) {
							box_flag = true;
							break;
						}

				widget.box_range.state.bound = lib0246.is_inside_rect(
					pos[0], pos[1],
					this.flex.hold_mouse[0], this.flex.hold_mouse[1], this.flex.hold_mouse[2], this.flex.hold_mouse[3]
				) ? "in" : "out";

				if (!widget.box_range.state.where || !box_flag)
					widget.box_range.state.where = "";

				if (!widget.box_range.state.action)
					widget.box_range.state.action = "";

				if (window.performance.now() - (widget.box_range.delay_state ?? 0) > widget.box_range.delay_dbl)
					widget.box_range.delay_state = null;

				box_range_eval_state(BOX_RANGE_STATE, node, widget, event, pos);
			},
		};

		widget.box_range = widget.box_range ?? {};
		widget.box_range.boxes = widget.box_range.boxes ?? [];
		widget.box_range.select = widget.box_range.select ?? [];

		widget.box_range.delay_dbl = widget.box_range.delay_dbl ?? options.delay_dbl ?? 200;
		widget.box_range.radius = widget.box_range.radius ?? options.radius ?? 15;

		widget_flex(node, widget, options);

		widget.row_count = options.row_count ?? 20;
		widget.col_count = options.col_count ?? 20;

		return widget;
	}

	function draw_chain(
		ctx,
		fill_c, stroke_c, line_w,
		link_w, link_h, spacing,
		box_x, box_y, box_w, box_h
	) {
		// Calculate how many links can fit in the box
		let links = Math.floor(box_w / (link_w + spacing));
	
		// Draw chain links
		for (let i = 0; i < links; ++ i) {
			let center_x = box_x + i * (link_w + spacing) + link_w / 2,
				center_y = box_y + box_h / 2;
			ctx.beginPath();
			ctx.fillStyle = fill_c;
			ctx.strokeStyle = stroke_c;
			ctx.lineWidth = line_w;
			ctx.ellipse(center_x, center_y, link_w / 2, link_h / 2, 0, 0, 2 * Math.PI);
			ctx.stroke();
			ctx.closePath();
		}
	}

	function draw_lock(ctx, x, y, width, height, flag) {
		const halve_w = 8,
			off_x = halve_w / 2,
			off_y = height / 3 + 0.5,
			calc_w = (width - halve_w) / 2,
			lift_y = flag ? 1.5 : 0,
			hole_color = flag ? "#4d4" : "#d44",
			thick_w = 1;

		// Draw entire red rect of x y width height
		// ctx.beginPath();
		// ctx.strokeStyle = "#ff0000";
		// ctx.rect(x, y, width, height);
		// ctx.stroke();
		// ctx.closePath();

		// Draw half arc
		ctx.beginPath();
		ctx.strokeStyle = LiteGraph.WIDGET_OUTLINE_COLOR;
		ctx.lineWidth = 1;
		ctx.arc(x + calc_w + off_x, y + off_y - lift_y, calc_w + thick_w / 2, Math.PI, 0, false);
		ctx.stroke();
		ctx.closePath();

		if (flag) {
			// Draw vertical line of the left side
			ctx.beginPath();
			ctx.strokeStyle = LiteGraph.WIDGET_OUTLINE_COLOR;
			ctx.lineWidth = 1;
			ctx.moveTo(x - thick_w / 2 + off_x, y + off_y - lift_y);
			ctx.lineTo(x - thick_w / 2 + off_x, y + off_y + lift_y);
			ctx.stroke();
			ctx.closePath();
		}

		// Draw round rect
		ctx.beginPath();
		ctx.strokeStyle = LiteGraph.WIDGET_OUTLINE_COLOR;
		ctx.fillStyle = LiteGraph.WIDGET_BGCOLOR;
		ctx.lineWidth = 1 + thick_w;
		ctx.roundRect(x + off_x, y + off_y + lift_y, width - halve_w, height - halve_w, [0, 0, 5, 5]);
		ctx.stroke();
		ctx.fill();
		ctx.closePath();

		// Draw circle at center of the rect
		ctx.beginPath();
		ctx.fillStyle = hole_color;
		ctx.lineWidth = 1;
		ctx.arc(x + calc_w + off_x, y + off_y / 2 + off_y + lift_y, 2, 0, Math.PI * 2);
		ctx.fill();
		ctx.closePath();

		// Draw triangle just below the circle
		ctx.beginPath();
		ctx.fillStyle = hole_color;
		ctx.lineWidth = 1;
		const tri_of_y = -1;
		ctx.moveTo(x + calc_w + off_x, y + off_y / 2 + off_y + lift_y + tri_of_y);
		ctx.lineTo(x + calc_w + off_x - 2, y + off_y / 2 + off_y + 6 + lift_y + tri_of_y);
		ctx.lineTo(x + calc_w + off_x + 2, y + off_y / 2 + off_y + 6 + lift_y + tri_of_y);
		ctx.fill();
		ctx.closePath();
	}

	function draw_number_lock(widget, ctx, x, y, widget_width, widget_height, left_margin, right_margin, text_margin, lock_margin, text, index, text_flag) {
		ctx.textAlign = "left";
		ctx.strokeStyle = LiteGraph.WIDGET_OUTLINE_COLOR;
		ctx.fillStyle = LiteGraph.WIDGET_BGCOLOR;

		ctx.beginPath();
		if (text_flag)
			ctx.roundRect(x + left_margin + lock_margin, y, widget_width - left_margin - right_margin - lock_margin, widget_height, [widget_height * 0.5]);
		else
			ctx.rect(x + left_margin + lock_margin, y, widget_width - left_margin - right_margin - lock_margin, widget_height);
		ctx.fill();
		if (text_flag) {
			if (!widget.disabled)
				ctx.stroke();

			ctx.fillStyle = LiteGraph.WIDGET_TEXT_COLOR;
			if (!widget.disabled) {
				ctx.beginPath();
				ctx.moveTo(x + left_margin + lock_margin + 16, y + 5);
				ctx.lineTo(x + left_margin + lock_margin + 6, y + widget_height * 0.5);
				ctx.lineTo(x + left_margin + lock_margin + 16, y + widget_height - 5);
				ctx.fill();
				ctx.beginPath();
				ctx.moveTo(x + widget_width - right_margin - 16, y + 5);
				ctx.lineTo(x + widget_width - right_margin - 6, y + widget_height * 0.5);
				ctx.lineTo(x + widget_width - right_margin - 16, y + widget_height - 5);
				ctx.fill();
			}
			ctx.fillStyle = LiteGraph.WIDGET_SECONDARY_TEXT_COLOR;
			ctx.fillText(`${widget.label ?? widget.name} (${text}: ${lib0246.snap(widget.value.data[index], widget.options.snap)})`, x + left_margin + text_margin + lock_margin + 5, y + widget_height * 0.7);
			ctx.fillStyle = LiteGraph.WIDGET_TEXT_COLOR;
			ctx.textAlign = "right";
			ctx.fillText(
				Number(widget.value.data[index]).toFixed(widget.options.precision ?? 3),
				x + widget_width - right_margin - text_margin - 20,
				y + widget_height * 0.7
			);
		}
		
		draw_lock(ctx, x + left_margin, y, widget_height, widget_height, widget.value.lock[index]);
	}

	function ratio_process_calc(widget, mode, old_value) {
		const data = widget.value.data,
			lock = widget.value.lock,
			opt = widget.options;
		switch (Math.abs(mode)) {
			case 1: {
				if (lock.height && !lock.ratio) {
					data.height = data.width / data.ratio;
					if (data.height < opt.min) {
						data.height = opt.min;
						data.width = data.height * data.ratio;
					} else if (data.height > opt.max) {
						data.height = opt.max;
						data.width = data.height * data.ratio;
					}
				} else if (!lock.height && lock.ratio) {
					data.ratio = data.width / data.height;
					if (data.ratio < opt.min) {
						data.ratio = opt.min;
						data.width = data.height * data.ratio;
					} else if (data.ratio > opt.max) {
						data.ratio = opt.max;
						data.width = data.height * data.ratio;
					}
				} else {
					lock.height = false;
					lock.ratio = false;
					data.width = old_value;
				}
			} break;
			case 2: {
				if (lock.width && !lock.ratio) {
					data.width = data.height * data.ratio;
					if (data.width < opt.min) {
						data.width = opt.min;
						data.height = data.width / data.ratio;
					} else if (data.width > opt.max) {
						data.width = opt.max;
						data.height = data.width / data.ratio;
					}
				} else if (!lock.width && lock.ratio) {
					data.ratio = data.width / data.height;
					if (data.ratio < opt.min) {
						data.ratio = opt.min;
						data.height = data.width / data.ratio;
					} else if (data.ratio > opt.max) {
						data.ratio = opt.max;
						data.height = data.width / data.ratio;
					}
				} else {
					lock.width = false;
					lock.ratio = false;
					data.height = old_value;
				}
			} break;
			case 3: {
				if (!lock.height && lock.width) {
					data.width = data.height * data.ratio;
					if (data.width < opt.min) {
						data.width = opt.min;
						data.height = data.width / data.ratio;
					} else if (data.width > opt.max) {
						data.width = opt.max;
						data.height = data.width / data.ratio;
					}
				} else if (!lock.width && lock.height) {
					data.height = data.width / data.ratio;
					if (data.height < opt.min) {
						data.height = opt.min;
						data.width = data.height * data.ratio;
					} else if (data.height > opt.max) {
						data.height = opt.max;
						data.width = data.height * data.ratio;
					}
				} else {
					lock.height = false;
					lock.width = false;
					data.ratio = old_value;
				}
			} break;
		}

		if (!Number.isFinite(data.width))
			data.width = 0;
		if (!Number.isFinite(data.height))
			data.height = 0;
		if (!Number.isFinite(data.ratio))
			data.ratio = 0;
	}

	function ratio_notify(node, widget, name, mode, old_value, value, pos, event) {
		if (/^[0-9+\-*/()\s]+|\d+\.\d+$/.test(value))
			try {
				widget.value.data[name] = Number(eval(value));
				ratio_process_calc(widget, mode, old_value);
				if (widget.options && widget.options.property && node.properties[widget.options.property] !== undefined)
					node.setProperty(widget.options.property, value);
				widget?.callback?.(widget.value, widget, node, pos, event);
			} catch (e) {}
	}

	function RATIO_WIDGET(node, data_type, data_name, options = {}) {
		const widget = {
			type: data_type,
			name: data_name,
			value: {
				lock: {
					ratio: false,
					width: false,
					height: false,
				},
				data: {
					ratio: 1,
					width: 512,
					height: 512,
				}
			},
			options: options,
			draw: function (ctx, node, widget_width, y, widget_height) {
				ctx.save();

				const show_text = app.canvas.ds.scale > 0.5,
					margin = 15,
					lock_margin = 20,
					text_margin = 15,
					calc_width = widget_width / 3;

				this.temp_w = widget_width;
				this.temp_h = widget_height;
				this.temp_y = y;

				draw_number_lock(this, ctx, 0, y, calc_width, widget_height, margin, 0, text_margin, lock_margin, "W", "width", show_text);
				draw_number_lock(this, ctx, calc_width, y, calc_width, widget_height, 0, 0, text_margin, lock_margin, "R", "ratio", show_text);
				draw_number_lock(this, ctx, calc_width * 2, y, calc_width, widget_height, 0, margin, text_margin, lock_margin, "H", "height", show_text);

				ctx.restore();
			},
			mouse: function (event, pos, node) {
				const margin = 15,
					lock_margin = 20,
					text_margin = 15,
					calc_width = this.temp_w / 3,
					hit_width = 20;

				let mode = 0, old_value;

				console.log(event.dragging);

				if (event.type === "pointerdown") {
					if (lib0246.is_inside_rect(
						pos[0], pos[1],
						margin, this.temp_y, this.temp_h, this.temp_h
					))
						this.value.lock.width = !this.value.lock.width;
					else if (lib0246.is_inside_rect(
						pos[0], pos[1],
						calc_width, this.temp_y, this.temp_h, this.temp_h
					))
						this.value.lock.ratio = !this.value.lock.ratio;
					else if (lib0246.is_inside_rect(
						pos[0], pos[1],
						calc_width * 2, this.temp_y, this.temp_h, this.temp_h
					))
						this.value.lock.height = !this.value.lock.height;

					else if (lib0246.is_inside_rect(
						pos[0], pos[1],
						margin + lock_margin, this.temp_y, hit_width, this.temp_h
					)) {
						mode = 1;
						old_value = this.value.data.width;
						this.value.data.width = Math.max(this.options.min, this.value.data.width - this.options.step * 0.1);
					}
					else if (lib0246.is_inside_rect(
						pos[0], pos[1],
						calc_width - lock_margin, this.temp_y, hit_width, this.temp_h
					)) {
						mode = 1;
						old_value = this.value.data.width;
						this.value.data.width = Math.max(this.options.min, this.value.data.width + this.options.step * 0.1);
					}

					else if (lib0246.is_inside_rect(
						pos[0], pos[1],
						calc_width + lock_margin, this.temp_y, hit_width, this.temp_h
					)) {
						mode = 3;
						old_value = this.value.data.ratio;
						this.value.data.ratio = Math.max(this.options.min, this.value.data.ratio - this.options.step * 0.001);
					}
					else if (lib0246.is_inside_rect(
						pos[0], pos[1],
						calc_width * 2 - lock_margin, this.temp_y, hit_width, this.temp_h
					)) {
						mode = 3;
						old_value = this.value.data.ratio;
						this.value.data.ratio = Math.max(this.options.min, this.value.data.ratio + this.options.step * 0.001);
					}

					else if (lib0246.is_inside_rect(
						pos[0], pos[1],
						calc_width * 2 + lock_margin, this.temp_y, hit_width, this.temp_h
					)) {
						mode = 2;
						old_value = this.value.data.height;
						this.value.data.height = Math.max(this.options.min, this.value.data.height - this.options.step * 0.1);
					}
					else if (lib0246.is_inside_rect(
						pos[0], pos[1],
						this.temp_w - margin - lock_margin, this.temp_y, hit_width, this.temp_h
					)) {
						mode = 2;
						old_value = this.value.data.height;
						this.value.data.height = Math.max(this.options.min, this.value.data.height + this.options.step * 0.1);
					}
				} else {
					if (lib0246.is_inside_rect(
						pos[0], pos[1],
						margin + lock_margin + hit_width, this.temp_y, (calc_width - lock_margin) - (margin + lock_margin + hit_width), this.temp_h
					)) {
						mode = 1;
						old_value = this.value.data.width;
						if (event.dragging) {
							this.value.data.width = Math.max(this.options.min, Math.min(this.options.max, this.value.data.width + event.deltaX * 0.1 * this.options.step));
							this.drag_flag = true;
						} else if (event.type === "pointerup")
							if (!this.drag_flag)
								app.canvas.prompt("Width", this.value.data.width, (value) => ratio_notify(node, this, "width", mode, old_value, value, pos, event), event);
							else
								this.drag_flag = false;
					} else if (lib0246.is_inside_rect(
						pos[0], pos[1],
						calc_width + lock_margin + hit_width, this.temp_y, (calc_width * 2 - lock_margin) - (calc_width + lock_margin + hit_width), this.temp_h
					)) {
						mode = 3;
						old_value = this.value.data.ratio;
						if (event.dragging) {
							this.value.data.ratio = Math.max(this.options.min, Math.min(this.options.max, this.value.data.ratio + event.deltaX * 0.001 * this.options.step));
							this.drag_flag = true;
						} else if (event.type === "pointerup")
							if (!this.drag_flag)
								app.canvas.prompt("Ratio", this.value.data.ratio, (value) => ratio_notify(node, this, "ratio", mode, old_value, value, pos, event), event);
							else
								this.drag_flag = false;
					} else if (lib0246.is_inside_rect(
						pos[0], pos[1],
						calc_width * 2 + lock_margin + hit_width, this.temp_y, (this.temp_w - margin - lock_margin) - (calc_width * 2 + lock_margin + hit_width), this.temp_h
					)) {
						mode = 2;
						old_value = this.value.data.height;
						if (event.dragging) {
							this.value.data.height = Math.max(this.options.min, Math.min(this.options.max, this.value.data.height + event.deltaX * 0.1 * this.options.step));
							this.drag_flag = true;
						} else if (event.type === "pointerup")
							if (!this.drag_flag)
								app.canvas.prompt("Height", this.value.data.height, (value) => ratio_notify(node, this, "height", mode, old_value, value, pos, event), event);
							else
								this.drag_flag = false;
					}
				}
				
				if (mode !== 0) {
					ratio_process_calc(this, mode, old_value);
					node?.onWidgetChanged?.(this.name, this.value, old_value, this);
				}
			},
		};
		widget.options.min = widget.options.min ?? 0;
		widget.options.max = widget.options.max ?? 2048;
		widget.options.step = widget.options.step ?? 10;
		widget.options.precision = widget.options.precision ?? 2;
		widget.options.snap = widget.options.snap ?? 8;
		return widget;
	}

	function SPACE_TITLE_WIDGET() {
		return {
			value: -1,
			type: "space_title",
			options: {
				serialize: false,
			},
			select: true,
			select_color: lib0246.rgb_to_hex(
				lib0246.rand_int(128, 255),
				lib0246.rand_int(128, 255),
				lib0246.rand_int(128, 255)
			),
			draw: function(ctx, node, widget_width, y, widget_height) {
				ctx.save();
				
				if (this.value > -1) {
					let widget_text = app.graph.getNodeById(this.value)?.title;
	
					if (widget_text)
						widget_text += ` (${this.value})`;
					else
						widget_text = this.value;
				
					const side_margin = widget_text.length + 5,
						text_measure = ctx.measureText(widget_text),
						text_center_y = (text_measure.actualBoundingBoxAscent + text_measure.actualBoundingBoxDescent) / 2,
						off_y = y + widget_height / 2;

					ctx.beginPath();
					ctx.fillStyle = this.select ? this.select_color : "#aaaaaa";
					ctx.font = "15px Consolas";
					ctx.textAlign = "center";
					ctx.fillText(widget_text, widget_width / 2, text_center_y + off_y);
					ctx.closePath();

					ctx.beginPath();
					ctx.strokeStyle = "#aaaaaa";
					ctx.lineWidth = 2;
					ctx.setLineDash([5, 5]);
					ctx.moveTo(0, off_y);
					ctx.lineTo(widget_width / 2 - text_measure.width / 2 - side_margin, off_y);
					ctx.stroke();
					ctx.closePath();

					ctx.beginPath();
					ctx.strokeStyle = "#aaaaaa";
					ctx.lineWidth = 2;
					ctx.setLineDash([5, 5]);
					ctx.moveTo(widget_width / 2 + text_measure.width / 2 + side_margin, off_y);
					ctx.lineTo(widget_width, off_y);
					ctx.stroke();
					ctx.closePath();
				} else {
					ctx.beginPath();
					ctx.strokeStyle = "#aaaaaa";
					ctx.lineWidth = 2;
					ctx.setLineDash([5, 5]);
					ctx.moveTo(0, y + widget_height / 2);
					ctx.lineTo(widget_width, y + widget_height / 2);
					ctx.stroke();
					ctx.closePath();
				}

				ctx.restore();
			},
			mouse: function(event, pos, node) {
				if (event.type === "pointerdown")
					this.select = !this.select;
			},
			computeSize: function() {
				return [0, 20];
			}
		};
	}

	const WIDGETS_MAP = new WeakMap();

	function setup_hijack_widget(node, name_fn) {
		const original_widgets = node.widgets;
		if (!original_widgets) return;
	
		// Store the original widgets before applying the proxy
		WIDGETS_MAP.set(node, original_widgets);
	
		node.widgets = new Proxy(original_widgets, {
			get(target, prop, receiver) {
				const original_widget = Reflect.get(target, prop, receiver);
				if (original_widget && typeof original_widget === 'object') {
					return new Proxy(original_widget, {
						get(widget_target, widget_prop) {
							if (widget_prop === 'name')
								return name_fn(node, widget_target);
							return Reflect.get(widget_target, widget_prop);
						}
					});
				}
				return original_widget;
			}
		});
	}
	
	function reset_hijack_widget(node) {
		if (WIDGETS_MAP.has(node)) {
			node.widgets = WIDGETS_MAP.get(node);
			WIDGETS_MAP.delete(node);
		}
	}

	const NODE_PARENT = Symbol("node_parent");

	function hijack_widget_name(node, widget) {
		if (node.comfyClass === "0246.Hub" && widget[NODE_PARENT])
			return `node:${widget[NODE_PARENT].id}:${widget.name}`;
		return widget.name;
	}

	/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

	app.registerExtension({
		name: "0246.Node",
		setup(app) {
			{
				const reroute_class = lib0246.clone_class(LiteGraph.registered_node_types.Reroute);

				reroute_class.prototype.onNodeCreated = function() {
					this.onConnectionsChange = () => {};

					const type_widget = this.addWidget("combo", "", "*", function(value, widget, node) {
						let curr_input_node = node.getInputNode(0),
							curr_output_node = node.getOutputNodes(0),
							prev_input_slot = app.graph.links?.[node.inputs[0].link]?.origin_slot,
							prev_output_slot = [];
						
						if (node.outputs[0].links)
							for (let i = 0; i < node.outputs[0].links.length; ++ i)
								prev_output_slot.push(app.graph.links[node.outputs[0].links[i]].target_slot);
						
						node.disconnectInput(0);
						node.disconnectOutput(0);

						process_reroute(node);

						if (curr_output_node && curr_output_node.length > 0) {
							node.inputs[0].widget = curr_output_node[0].inputs[prev_output_slot[0]].widget;
							for (let i = 0; i < curr_output_node.length; ++ i)
								node.connect(0, curr_output_node[i], prev_output_slot[i]);
						} else
							node.inputs[0].widget = {};

						if (curr_input_node)
							curr_input_node.connect(prev_input_slot, node, 0);
					}, {
						values: type_defs
					});

					type_widget.y = 3;
					let prev_size = this.computeSize();
					prev_size[0] = 100;

					// Prevent error
					// [TODO] Set widget from output/input pin if exist, else just empty object
					this.inputs[0].widget = {};

					this.setSize(prev_size);
				};

				lib0246.hijack(reroute_class.prototype, "onDrawForeground", function () {
					process_reroute(this.self);
				}, () => {});

				lib0246.hijack(reroute_class.prototype, "configure", () => {}, function (data) {
					process_reroute(this.self, data.inputs[0].type);
					if (this.self?.outputs?.[0]?.links?.length > 0)
						this.self.inputs[0].widget = app.graph.links[this.self.outputs[0].links[0]].target_node?.inputs[app.graph.links[this.self.outputs[0].links[0]].target_slot].widget ?? {};
				});

				LiteGraph.registerNodeType(
					"0246.CastReroute",
					Object.assign(reroute_class, {
						title_mode: LiteGraph.NO_TITLE,
						title: "Cast Reroute",
						collapsable: false,
					})
				);

				reroute_class.category = "0246";
			}

			lib0246.hijack(app.canvas, "processNodeWidgets", function (node) {
				PROCESS_WIDGET_NODE = node;
			}, function (node) {
				PROCESS_WIDGET_NODE = null;
			});

			lib0246.hijack(app.canvas, "drawNodeWidgets", function () {
				const node = arguments[0];
				FLEX_DB.set(node, true);
				if (node.comfyClass === "0246.Hub") {
					node.hub.temp_y = node.hub.temp_y ?? {};
					const io_height = Math.max(node?.inputs?.length ?? 0, node?.outputs?.length ?? 0) * 24;
					node.hub.curr_y = io_height;
					let compute_height = node.size[1],
						widget_count = 0;

					for (; widget_count < node.widgets.length; ++ widget_count) {
						if (
							node.widgets[widget_count] === app.graph.getNodeById(node.hub?.data?.node_list?.[0])?.widgets?.[0] ||
							node.widgets[widget_count].type === "space_title"
						)
							break;
						node.hub.curr_y += LiteGraph.NODE_WIDGET_HEIGHT + 4;
					}

					if (node.hub.sole_space) {
						node.hub.curr_y += LiteGraph.NODE_WIDGET_HEIGHT + 8 - node.hub.sole_widget.length * 4;
						++ widget_count;
					}

					for (let i = 0; i < node.hub.sole_widget.length; ++ i, ++ widget_count) {
						const curr_widget = node.hub.sole_widget[i];
						if (curr_widget.y !== undefined)
							node.hub.temp_y[widget_count] = curr_widget.y;
						curr_widget.y = node.hub.curr_y;
						node.hub.curr_y += LiteGraph.NODE_WIDGET_HEIGHT + 4; // [TODO] Maybe add checks like below
					}

					if (node.hub.data)
						for (let i = 0; i < node.hub.data.node_list.length; ++ i) {
							const curr_node = app.graph.getNodeById(node.hub.data.node_list[i]);
							if (node.widgets.length <= widget_count || !curr_node)
								break;
							node.widgets[widget_count ++].y = node.hub.curr_y;
							node.hub.curr_y += LiteGraph.NODE_WIDGET_HEIGHT + 4;
							for (let j = 0; j < curr_node.widgets.length; ++ j, ++ widget_count) {
								const curr_widget = curr_node.widgets[j];
								if (curr_widget.y !== undefined)
									node.hub.temp_y[widget_count] = curr_widget.y;
								curr_widget.y = node.hub.curr_y;
								if (curr_widget.flex) {
									curr_widget.flex.real_w = node.size[0];
									curr_widget.flex.real_y = node.hub.curr_y;
									node.hub.curr_y += curr_widget.flex.temp_h;
								} else if (curr_widget.computedHeight) {
									node.hub.curr_y += curr_widget.computedHeight + 4;
									compute_height += curr_widget.computedHeight;
								} else if (curr_widget.openpose) {
									node.hub.curr_y += node.size[0];
								} else if (curr_widget.painter_wrap) {
									node.hub.curr_y += Math.max((
										curr_widget.painter_toolbox = curr_widget.painter_toolbox ?? document.querySelector("div.painter_drawning_box")
									).clientHeight / app.canvas.ds.scale + 4, node.size[0]);
									app.canvas.setDirty(true);
								} else if (curr_widget.computeSize) {
									const curr_height = curr_widget.computeSize(node.size[0], node)[1]; // compute_height, raw_height - io_height + flex_height
									node.hub.curr_y += curr_height + 4;
								} else
									node.hub.curr_y += LiteGraph.NODE_WIDGET_HEIGHT + 4;
							}
						}
				}
			}, function () {
				const node = arguments[0];
				FLEX_DB.set(node, false);
				if (node.comfyClass === "0246.Hub") {
					let curr_size = node.computeSize();
					for (let i = 0; i < node.widgets.length; ++ i) {
						if (node.hub.temp_y[i] !== undefined)
							node.widgets[i].y = node.hub.temp_y[i];
						else
							node.widgets[i].y = undefined;
						delete node.hub.temp_y[i];
					}
					curr_size[0] = node.size[0];
					curr_size[1] = node.hub.curr_y + 2;
					node.setSize(curr_size);
				}
			});

			lib0246.hijack(app, "graphToPrompt", async function () {
				for (let i = 0; i < this.self.graph._nodes.length; ++ i) {
					const node = this.self.graph._nodes[i];
					if (node.comfyClass === "0246.Hub")
						setup_hijack_widget(node, hijack_widget_name);
				}
			}, async function () {
				for (let i = 0; i < this.self.graph._nodes.length; ++ i) {
					const node = this.self.graph._nodes[i];
					if (node.comfyClass === "0246.Hub")
						reset_hijack_widget(node);
				}
			});
		},
		nodeCreated(node) {
			switch (node.comfyClass) {
				case "0246.Highway": {
					node.color = LGraphCanvas.node_colors.brown.color;
					node.bgcolor = LGraphCanvas.node_colors.brown.bgcolor;
				} break;
				case "0246.HighwayBatch": {
					node.color = lib0246.mix_color_hue(LGraphCanvas.node_colors.brown.color, "#660029");
					node.bgcolor = LGraphCanvas.node_colors.brown.bgcolor;
				} break;
				case "0246.Junction": {
					node.color = LGraphCanvas.node_colors.blue.color;
					node.bgcolor = LGraphCanvas.node_colors.blue.bgcolor;
				} break;
				case "0246.JunctionBatch": {
					node.color = lib0246.mix_color_hue(LGraphCanvas.node_colors.blue.color, "#660029");
					node.bgcolor = LGraphCanvas.node_colors.blue.bgcolor;
				} break;
				case "0246.Loop": {
					node.color = LGraphCanvas.node_colors.yellow.color;
					node.bgcolor = LGraphCanvas.node_colors.yellow.bgcolor;
				} break;
				case "0246.Count": {
					node.color = LGraphCanvas.node_colors.green.color;
					node.bgcolor = LGraphCanvas.node_colors.yellow.bgcolor;
				} break;
				case "0246.Hold": {
					node.color = "#666600";
					node.bgcolor = LGraphCanvas.node_colors.yellow.bgcolor;
				} break;
				case "0246.Beautify": {
					// Pink UwU
					node.color = "#652069";
					node.bgcolor = "#764378";
				} break;
				case "0246.RandomInt": {
					node.color = LGraphCanvas.node_colors.red.color;
					node.bgcolor = LGraphCanvas.node_colors.green.bgcolor;
				} break;
				case "0246.Stringify": {
					node.color = LGraphCanvas.node_colors.red.color;
					node.bgcolor = LGraphCanvas.node_colors.green.bgcolor;
				} break;
				case "0246.Merge": {
					node.color = "#660029";
					node.bgcolor = "#4d001f";
				} break;
				case "0246.BoxRange": {
					node.color = LGraphCanvas.node_colors.green.color;
					node.bgcolor = LGraphCanvas.node_colors.green.bgcolor;
				} break;
				case "0246.ScriptImbue": {
					node.color = lib0246.mix_color_hue(LGraphCanvas.node_colors.green.color, "#660029");
					node.bgcolor = "#4d001f";
				} break;
				case "0246.ScriptPlan": {
					node.color = "#660029";
					node.bgcolor = lib0246.mix_color_hue(LGraphCanvas.node_colors.green.bgcolor, "#660029");
				} break;
				case "0246.Script": {
					node.color = lib0246.mix_color_hue(LGraphCanvas.node_colors.green.color, "#660029");
					node.bgcolor = lib0246.mix_color_hue(LGraphCanvas.node_colors.green.bgcolor, "#660029");
				} break;
				case "0246.Hub": {
					node.color = "#1a1a1a";
					node.bgcolor = "#111";
				} break;
			}
		},
		async beforeRegisterNodeDef (nodeType, nodeData, app) {
			// if (nodeData.category === "group nodes/workflow")
			// 	GROUP_NODE_CATEGORY_LIST.push(nodeData.comfyClass);
			if (nodeData.category === "0246") {
				switch (nodeData.name) {
					case "0246.BoxRange": {
						lib0246.hijack(nodeType.prototype, "onNodeCreated", () => {}, function () {
							const node = this.self;
							const ratio_widget = node.addCustomWidget(RATIO_WIDGET(node, "RATIO_RANGE", "box_ratio"));
							const box_widget = node.addCustomWidget(BOX_RANGE_WIDGET(node, "BOX_RANGE", "box_range", {
								row_count: 10,
								col_count: 10,
								ratio: 0,
								share: 1,
								min_h: 50,
								center: true,
							}));

							lib0246.hijack(node, "getExtraMenuOptions", function (canvas, options) {
								help_option(nodeType, HELP["box_range"], options);
							}, () => {});

							ratio_widget.callback = function (value, widget, node, pos, event) {
								if (widget.name === "box_ratio") {
									box_widget.flex.ratio =	widget.value.data.ratio;
									app.canvas.setDirty(true);
								}
							};

							lib0246.hijack(node, "onWidgetChanged", function (name, value, old_value, widget) {
								if (name === "box_ratio")
									box_widget.flex.ratio = value.data.ratio;
							}, () => {});

							box_widget.flex.ratio = ratio_widget.value.data.ratio;

							node.serialize_widgets = true;
							node.setSize(node.computeSize());
						});
					} break;
					case "0246.Highway": {
						highway_impl(nodeType, nodeData, app, LiteGraph.CIRCLE_SHAPE, LiteGraph.CIRCLE_SHAPE);
					} break;
					case "0246.HighwayBatch": {
						highway_impl(nodeType, nodeData, app, LiteGraph.GRID_SHAPE, LiteGraph.GRID_SHAPE);
					} break;
					case "0246.Junction": {
						junction_impl(nodeType, nodeData, app, "_offset", LiteGraph.CIRCLE_SHAPE, LiteGraph.CIRCLE_SHAPE);
					} break;
					case "0246.JunctionBatch": {
						// [TODO] Dynamically change shape when _mode is changed
						junction_impl(nodeType, nodeData, app, "_offset", LiteGraph.GRID_SHAPE, LiteGraph.GRID_SHAPE);
					} break;
					case "0246.Loop": {
						single_impl_input(nodeType, nodeData, app, LiteGraph.CIRCLE_SHAPE, []);
					} break;
					case "0246.Count": {
						single_impl_input(nodeType, nodeData, app, null, [
							"_node", "input", 1, LiteGraph.CIRCLE_SHAPE
						]);
						setup_log(nodeType);
					} break;
					case "0246.Hold": {
						single_impl_input(nodeType, nodeData, app, null, [
							"_data_in", "input", 1, LiteGraph.CIRCLE_SHAPE,
							"_data_out", "output", 2, LiteGraph.GRID_SHAPE
						]);
						setup_log(nodeType);
					} break;
					case "0246.RandomInt": {
						lib0246.hijack(nodeType.prototype, "onNodeCreated", () => {}, function () {
							const self = this.self;
							self.outputs[0].shape = LiteGraph.GRID_SHAPE;
							this.self.addWidget("button", "Random Seed", null, () => {
								const seed_widget = self.widgets.find(w => w.name === "seed");
								seed_widget.value = Math.floor(Math.random() * (seed_widget.options.max - seed_widget.options.min + 1)) + seed_widget.options.min;
							}, {
								serialize: false
							});
							this.self.addWidget("button", "Random Value", null, () => {
								const val_widget = self.widgets.find(w => w.name === "val"),
									min_widget = self.widgets.find(w => w.name === "min"),
									max_widget = self.widgets.find(w => w.name === "max"),
									batch_widget = self.widgets.find(w => w.name === "batch_size");

								let res = val_widget.value.split(",");

								if (res.length > batch_widget.value)
									res.length = batch_widget.value;
								else if (res.length < batch_widget.value)
									for (let i = res.length; i < batch_widget.value; ++ i)
										res.push("0");

								for (let i = 0; i < batch_widget.value; ++ i) {
									if (res[i])
										res[i] = res[i].trim();
									if (res[i] !== "rand" && res[i] !== "add" && res[i] !== "sub")
										res[i] = String(Math.floor(Math.random() * (max_widget.value - min_widget.value + 1)) + min_widget.value);
								}

								val_widget.value = res.join(", ");
							}, {
								serialize: false
							});
							this.self.addWidget("button", "Change Mode", null, () => {
								const val_widget = self.widgets.find(w => w.name === "val"),
									batch_widget = self.widgets.find(w => w.name === "batch_size");

								let res = val_widget.value.split(",");

								if (res.length > batch_widget.value)
									res.length = batch_widget.value;
								else if (res.length < batch_widget.value)
									for (let i = res.length; i < batch_widget.value; ++ i)
										res.push("sub");
								
								for (let i = 0; i < batch_widget.value; ++ i)
									if (res[i]) {
										res[i] = res[i].trim();
										if (isNaN(res[i])) {
											if (res[i] !== "rand" && res[i] !== "add")
												res[i] = "rand";
											else if (res[i] === "rand")
												res[i] = "add";
											else
												res[i] = "sub";
										}
									}

								val_widget.value = res.join(", ");
							}, {
								serialize: false
							});
						});
						setup_log(nodeType, true);
					} break;
					case "0246.Beautify": {
						setup_log(nodeType);
					} break;
					case "0246.Stringify": {
						single_impl_input(nodeType, nodeData, app, LiteGraph.CIRCLE_SHAPE, []);
					} break;
					case "0246.Merge": {
						single_impl_input(nodeType, nodeData, app, LiteGraph.CIRCLE_SHAPE, []);
					} break;
					case "0246.Hub": {
						const Hub = nodeType,
							HUB_PARENT = Symbol("hub_parent"),
							HUB_SOLE = 7;

						// [TODO] Force tracked node render by hijack app.canvas.computeVisibleNodes and
							// change getBounding of each nodes to be within app.canvas.visible_area

						Hub.prototype.onNodeCreated = function() {
							const node = this;

							const prim_widget = node.addWidget("combo", "base:prim", "INT", () => {}, {
								serialize: false,
								values: ["INT", "FLOAT", "STRING", "BOOLEAN"]
							});
							node.addWidget("button", "Add Sole Primitive Widget", null, () => {
								node.hubPushWidgetPrim(prim_widget.value);
							}, {
								serialize: false
							});
							
							const combo_widget = node.addWidget("combo", "base:combo", ["KSampler", "required", "sampler_name"], () => {}, {
								serialize: false,
								values: (function () {
									let res = [];
									for (let key in defs)
										for (let input in defs[key].input)
											for (let type in defs[key].input[input])
												if (Array.isArray(defs[key].input[input][type][0]))
													res.push([key, input, type]);
									return res;
								})()
							});
							node.addWidget("button", "Add Sole Combo Widget", null, () => {
								node.hubPushWidgetCombo(...combo_widget.value);
							}, {
								serialize: false
							});
							
							const node_widget = node.addWidget("combo", "base:node", "KSampler", () => {}, {
								serialize: false,
								values: Object.keys(defs)
							});
							node.addWidget("button", "Add Sole Primitive Widgets from Node", null, () => {
								node.hubPushWidgetNode(node_widget.value);
							}, {
								serialize: false
							});

							const del_widget = node.addWidget("combo", "base:del", "", () => {}, {
								serialize: false,
								values: function (widget) {
									let res = [];
									for (let i = 0; i < node.hub.sole_widget.length; ++ i)
										res.push(node.hub.sole_widget[i].name);
									return res;
								}
							});
							node.addWidget("button", "Delete Sole Widget", null, () => {
								node.hubPullWidget(node.hub.sole_widget.find(w => w.name === del_widget.value));
							}, {
								serialize: false
							});

							lib0246.hijack(node, "connect", function (slot, target_node, target_slot) {
								const output_data = this.self.hub.data.sole_type[this.self.outputs[slot].name];
								if (output_data[2] === "combo") {
									Hub.nodeData = Hub.nodeData ?? {};
									Hub.nodeData.output = Hub.nodeData.output ?? {};
									Hub.nodeData.output[slot] = defs[output_data[3]].input[output_data[4]][output_data[5]][0];
								}
							}, function (slot, target_node, target_slot) {
								const output_data = this.self.hub.data.sole_type[this.self.outputs[slot].name];
								if (output_data[2] === "combo")
									delete Hub.nodeData.output[slot];
							});

							node.size[0] = 350;
						};

						lib0246.hijack(Hub.prototype, "onAdded", () => {}, function () {
							const node = this.self;

							node.hub = node.hub ?? {};

							app.graph.extra["0246.HUB_DATA"] = app.graph.extra["0246.HUB_DATA"] ?? {};
							app.graph.extra["0246.HUB_DATA"][node.id] = app.graph.extra["0246.HUB_DATA"][node.id] ?? {};
							node.hub.data = app.graph.extra["0246.HUB_DATA"][node.id];

							node.hub.data.node_list = node.hub.data.node_list ?? [];
							node.hub.data.node_img = node.hub.data.node_img ?? [];
							node.hub.data.sole_name = node.hub.data.sole_name ?? {};
							node.hub.data.sole_type = node.hub.data.sole_type ?? {};
							
							// Temp data
							node.hub.node_area = {};
							node.hub.node_widget = {};
							node.hub.space_widget = {};
							node.hub.node_func = {};

							node.hub.sole_widget = [];
							node.hub.sole_space = null;
						});

						lib0246.hijack(Hub.prototype, "onConfigure", () => {}, function (data) {
							const node = this.self;

							for (let node_id of app.graph.extra["0246.HUB_DATA"][node.id].node_list)
								node.hubPushNode(app.graph.getNodeById(node_id), true);

							if (node.outputs && node.outputs.length > 0) {
								let count = 0, widget;
								for (let name in node.hub.data.sole_type) {
									const proc_name = name.split(":"),
										type_data = node.hub.data.sole_type[name].slice(3, 6);
									switch (proc_name[2]) {
										case "int": {
											widget = node.hubPushWidgetPrim("INT", ...type_data, name);
										} break;
										case "float": {
											widget = node.hubPushWidgetPrim("FLOAT", ...type_data, name);
										} break;
										case "string": {
											widget = node.hubPushWidgetPrim("STRING", ...type_data, name);
										} break;
										case "boolean": {
											widget = node.hubPushWidgetPrim("BOOLEAN", ...type_data, name);
										} break;
										case "combo": {
											widget = node.hubPushWidgetCombo(...type_data, name);
										} break;
									}
									widget.value = data.widgets_values[HUB_SOLE + 2 + (count ++)];
								}
							}
						});

						lib0246.hijack(Hub.prototype, "onRemoved", function () {
							const node = this.self;
							if (node.hub.data)
								while (node.hub.data.node_list.length > 0)
									node.hubPullNode(node.hub.data.node_list[0]);
							delete app.graph.extra["0246.HUB_DATA"][node.id];
						}, () => {});

						lib0246.hijack(Hub.prototype, "getExtraMenuOptions", function (canvas, options) {
							const node = this.self;
							options.push(
								{
									content: "[0246.Hub] Add widgets from \"graph selected nodes\"",
									callback: function() {
										for (let key in app.canvas.selected_nodes) {
											const curr_node = app.canvas.selected_nodes[key];
											if (curr_node === node || node.isVirtualNode || curr_node.type === "0246.Hub")
												continue;

											node.hubPushNode(curr_node);
										}
										app.canvas.setDirty(true);
									}
								}, {
									content: "[0246.Hub] Add sole widgets from \"graph selected nodes\"",
									callback: function() {
										for (let key in app.canvas.selected_nodes) {
											const curr_node = app.canvas.selected_nodes[key];
											if (curr_node === node || node.isVirtualNode || curr_node.type === "0246.Hub")
												continue;
											node.hubPushNode(curr_node.type);
										}
										app.canvas.setDirty(true);
									}
								}, {
									content: "[0246.Hub] Remove widgets from \"hub selected nodes\"",
									callback: function() {
										for (let node_id in node.hub.space_widget) {
											if (node.hub.space_widget[node_id].select)
												node.hubPullNode(node.hub.space_widget[node_id].value);
										}
										app.canvas.setDirty(true);
									}
								}
							);

							help_option(Hub, HELP["hub"], options);

							options.push(null);
						}, () => {});

						Hub.prototype.hubSize = function () {
							const curr_size = this.computeSize();
							curr_size[0] = this.size[0] < 350 ? 350 : this.size[0];
							this.setSize(curr_size);
						};

						Hub.prototype.hubPushWidgetPrim = function (type, ...args) {
							const node = this;
							switch (type) {
								case "INT": {
									return node.hubPushWidget({
										type: "number",
										value: 0,
										options: {
											min: Number.MIN_SAFE_INTEGER,
											max: Number.MAX_SAFE_INTEGER,
											step: 10, // litegraph.js internally multiply by 0.1
											precision: 0
										},
									}, "int", "INT", ...args);
								} break;
								case "FLOAT": {
									return node.hubPushWidget({
										type: "number",
										value: 0,
										options: {
											min: -Infinity,
											max: Infinity,
											step: 1,
											precision: 5
										},
									}, "float", "FLOAT", ...args);
								} break;
								case "STRING": {
									return node.hubPushWidget({
										type: "string",
										value: "",
										options: {
											multiline: true
										}
									}, "string", "STRING", ...args);
								} break;
								case "BOOLEAN": {
									return node.hubPushWidget({
										type: "toggle",
										value: false,
										options: {}
									}, "boolean", "BOOLEAN", ...args);
								} break;
							}
						};

						Hub.prototype.hubPushWidgetCombo = function (node_name, part_name, pin_name, full_name) {
							const combo_data = defs[node_name].input[part_name][pin_name][0];

							return this.hubPushWidget({
								type: "combo",
								value: combo_data[0],
								options: {
									values: combo_data
								},
							}, "combo", "COMBO", node_name, part_name, pin_name, full_name);
						};

						Hub.prototype.hubPushWidgetNode = function (node_name, full_name) {
							for (let part_name in defs[node_name].input)
								for (let pin_name in defs[node_name].input[part_name]) {
									const curr_type = defs[node_name].input[part_name][pin_name][0];
									if (Array.isArray(curr_type))
										this.hubPushWidgetCombo(node_name, part_name, pin_name, full_name);
									else
										this.hubPushWidgetPrim(curr_type, node_name, part_name, pin_name, full_name);
								}
						};

						Hub.prototype.hubPushWidget = function (widget, id_type, pin_type, node_name, part_name, pin_name, full_name) {
							if (!this.hub.sole_space) {
								this.hub.sole_space = SPACE_TITLE_WIDGET();
								this.widgets.splice(HUB_SOLE + 1, 0, this.hub.sole_space);
							}

							this.widgets.splice(HUB_SOLE + 2 + this.hub.sole_widget.length, 0, widget);
							this.hub.sole_widget.push(widget);

							if (typeof full_name === "string")
								widget.name = full_name;
							else {
								this.hub.data.sole_name[id_type] = this.hub.data.sole_name[id_type] ?? 0;

								let list_name = [
									"sole", String(this.hub.data.sole_name[id_type] ++),
									id_type, node_name, part_name, pin_name, pin_type
								];

								full_name = list_name.reduce((a, b) =>
									typeof a !== "string" ? (b ?? "") :
									typeof b !== "string" ? (a ?? "") :
									a + ":" + b
								);

								this.addOutput(widget.name = full_name, pin_type);
								this.hub.data.sole_type[full_name] = list_name;
							}

							this.hubSize();

							return widget;
						};

						Hub.prototype.hubPullWidget = function (widget) {
							const widget_index = this.widgets.indexOf(widget);
							if (widget_index === -1)
								return;
							this.widgets.splice(widget_index, 1);
							
							delete this.hub.data.sole_type[widget.name];

							const output_index = this.outputs.indexOf(this.outputs.find(o => o.name === widget.name));
							if (output_index > -1) {
								delete Hub.nodeData.output[output_index];
								this.removeOutput(output_index);
							}

							const sole_widget_index = this.hub.sole_widget.indexOf(widget);
							if (sole_widget_index > -1)
								this.hub.sole_widget.splice(sole_widget_index, 1);

							if (this.hub.sole_widget.length === 0) {
								this.widgets.splice(HUB_SOLE + 1, 1);
								this.hub.sole_space = null;
							}

							this.hubSize();
						};

						Hub.prototype.hubPushNode = function (curr_node, flag = false) {
							const node = this;

							if (curr_node[HUB_PARENT] === node || !curr_node.widgets || curr_node.widgets.length === 0)
								return;

							curr_node[HUB_PARENT] = node;

							if (!flag || (flag && node.hub.data.node_list.indexOf(curr_node.id) === -1))
								node.hub.data.node_list.push(curr_node.id);

							node.hub.node_func[curr_node.id] = {};

							node.hub.node_func[curr_node.id].bound = lib0246.hijack(curr_node, "onBounding", () => {}, function (area) {
								node.hub.node_area[curr_node.id] = area;
							});

							node.hub.node_func[curr_node.id].remove = lib0246.hijack(curr_node, "onRemoved", function () {
								node.hubPullNode(curr_node.id);
							}, () => {});

							node.hub.node_widget[curr_node.id] = curr_node.widgets;

							node.hub.space_widget[curr_node.id] = node.addCustomWidget(SPACE_TITLE_WIDGET());
							node.hub.space_widget[curr_node.id].value = curr_node.id;

							node.hub.node_func[curr_node.id].draw_bg = lib0246.hijack(curr_node, "onDrawBackground", () => {}, function (ctx, visible_area) {
								const curr_widget = node.hub.space_widget[curr_node.id];
								if (node.hub.space_widget[curr_node.id].select) {
									ctx.beginPath();
									ctx.strokeStyle = curr_widget.select_color;
									ctx.lineWidth = 2;
									ctx.setLineDash([]);
									ctx.roundRect(
										-12, -12 - LiteGraph.NODE_TITLE_HEIGHT,
										this.self.size[0] + 24, this.self.size[1] + 24 + LiteGraph.NODE_TITLE_HEIGHT,
										5, 5
									);
									ctx.stroke();
									ctx.closePath();
								}
							});

							for (let i = 0; i < curr_node.widgets.length; ++ i) {
								const widget = curr_node.widgets[i];
								node.addCustomWidget(widget);
								widget[NODE_PARENT] = curr_node;
							}

							if (curr_node.imgs && curr_node.imgs.length > 0)
								node.hub.data.node_img.push(curr_node.id);

							node.hubSize();
						};

						Hub.prototype.hubPullNode = function (curr_id) {
							const node_index = this.hub.data.node_list.indexOf(curr_id);
							if (node_index === -1)
								return;
							this.hub.data.node_list.splice(node_index, 1);
							const node_img_index = this.hub.data.node_img.indexOf(curr_id);
							if (node_img_index > -1)
								this.hub.data.node_img.splice(node_img_index, 1);

							delete this.hub.node_area[curr_id];
							if (this.hub.node_widget[curr_id]) {
								for (let widget of this.hub.node_widget[curr_id]) {
									let widget_index = this.widgets.indexOf(widget);
									if (widget_index > -1)
										this.widgets.splice(widget_index, 1);
								}
								delete this.hub.node_widget[curr_id];
							}
							const space_widget_index = this.widgets.indexOf(this.hub.space_widget[curr_id]);
							if (space_widget_index > -1)
								this.widgets.splice(space_widget_index, 1);
							delete this.hub.space_widget[curr_id];

							const curr_node = app.graph.getNodeById(curr_id);
							if (curr_node && this.hub.node_func[curr_id]) {
								delete curr_node[HUB_PARENT];
								curr_node.onBounding = this.hub.node_func[curr_id].bound;
								curr_node.onRemoved = this.hub.node_func[curr_id].remove;
								curr_node.onDrawBackground = this.hub.node_func[curr_id].draw_bg;
							}
							delete this.hub.node_func[curr_id];

							this.hubSize();
						};

						let temp_parent = [];

						lib0246.hijack(GroupNodeHandler, "fromNodes", function (nodes) {
							for (let i = 0; i < nodes.length; ++ i)
								if (nodes[i][HUB_PARENT] && temp_parent.indexOf(nodes[i].id) === -1) {
									temp_parent.push(nodes[i][HUB_PARENT].id);
									nodes[i][HUB_PARENT].hubPullNode(nodes[i].id);
								}
						}, function () {
							if (this.res) {
								const node_list = this.res.getInnerNodes();

								let count = 0;

								while (temp_parent.length > 0) {
									const curr_parent = app.graph.getNodeById(temp_parent.pop());
									curr_parent.hubPushNode(this.res);
									node_list[count ++][HUB_PARENT] = curr_parent;
								}

								lib0246.hijack(this.res, "convertToNodes", function () {
									for (let i = 0; i < node_list.length; ++ i) 
										if (node_list[i][HUB_PARENT]) {
											node_list[i][HUB_PARENT].hubPullNode(node_list[i].id);
											temp_parent.push(node_list[i][HUB_PARENT].id, node_list[i].id);
										}
								}, function () {
									while (temp_parent.length > 0) {
										const curr_node = app.graph.getNodeById(temp_parent.pop()),
											curr_parent = app.graph.getNodeById(temp_parent.pop());

										for (let i = 0; i < this.res.length; ++ i)
											if (this.res[i].id === curr_node.id) {
												curr_parent.hubPushNode(this.res[i]);
												break;
											}
									}
								});
							}
						});

						rgthree_exec("addConnectionLayoutSupport", Hub, app);
					} break;
					case "0246.Script": {
						junction_impl(nodeType, nodeData, app, null, LiteGraph.GRID_SHAPE, LiteGraph.GRID_SHAPE);
					} break;
					case "0246.ScriptPlan": {
						lib0246.hijack(nodeType.prototype, "onNodeCreated", () => {}, function () {
							const chain_widget = this.self.widgets.find(w => w.name === "script_chain_type");
							chain_widget.options = chain_widget.options ?? {};
							chain_widget.options.multiline = true;
						});
					} break;
				}
			}
		},
	});

	// var curr_node = LiteGraph.createNode(LiteGraph.getNodeTypesInCategory(LiteGraph.getNodeTypesCategories()[2])[2].type);
})();
