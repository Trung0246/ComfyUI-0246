export const HELP = {
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
		<span>
			There'res a "secret" mode such that when all 3 are unlocked or locked and change the "ratio", it will actually 
			changes the "area" of the box instead. All 3 locked means "width" are pinned, all 3 unlocked means "height" are pinned.
		</span>
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

import { app, ANIM_PREVIEW_WIDGET } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";
import { ComfyWidgets } from "../../../scripts/widgets.js";
// import * as comfy_widget from "../../../extensions/core/widgetInputs.js";

import * as lib0246 from "./utils.js";

export let defs, node_defs = [], combo_defs = [], type_defs = new Set();

let rgthree_utils;

export function rgthree_exec(name, ...args) {
	return rgthree_utils?.[name]?.apply(null, args);
}

export function help_option(node, content, app) {
	// Guess this is good enough
	rgthree_exec("addHelpMenuItem", node, content, app);
}

lib0246.hijack(app, "registerNodesFromDefs", async function (_defs) {
	if (!this.mark && !Array.isArray(type_defs)) {
		defs = _defs;

		for (let key in defs) {
			node_defs.push(key);
			for (let idx in defs[key].output)
				if (!Array.isArray(defs[key].output[idx]))
					type_defs.add(defs[key].output[idx]);
			for (let idx in defs[key].input)
				for (let type in defs[key].input[idx])
					if (Array.isArray(defs[key].input[idx][type][0]))
						combo_defs.push([key, idx, type]);
		}

		type_defs = [...type_defs.values()];
	}
});

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

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

function link_shift_up(node, arr, index, flag, data) {
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
				if (node?.onConnectExpand?.("shift_output", arr[i].name, i, ...data))
					continue;
				arr[i].name = node?.onNameExpand?.(true, LiteGraph.OUTPUT, arr[i].name, i, ...data) ?? `${arr[i].type}:${c}`;
				++ c;
			}
		}
	} else {
		node.removeInput(index);

		for (let i = 0, c = 0; i < arr.length; ++ i) {
			if (node?.onConnectExpand?.("shift_input", arr[i].name, i, ...data))
				continue;
			arr[i].name = node?.onNameExpand?.(true, LiteGraph.INPUT, arr[i].name, i, ...data) ?? `${c}:${arr[i].type}`;
			++ c;
		}
	}
	app.canvas.setDirty(true);
	
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
	"_data",
	"_cloud_in",
	"_cloud_out",
	"..."
];

function expand_blacklist_func(mode, name) {
	if (this.mark && this.res !== true)
		this.res = BLACKLIST.includes(name);
}

const LEGACY_BLACKLIST = {
	prev: ["_pipe_in", "_pipe_out"],
	next: ["_way_in", "_way_out"],
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const RESIZE_OBSERVER = Symbol("resize_observer");
export const SOFT_REMOVE = Symbol("soft_remove");

function dom_resize_calc(node, widget) {
	// Very bruh
	widget.computedHeight = null;
	node.flags = node.flags ?? {};
	const old_collapsed = node.flags.collapsed,
		old_h = node.size[1],
		old_hide = widget.options?.onHide,
		old_elem_hide = widget.element.hidden,
		old_elem_display = widget.element.style.display;
	widget.options.onHide = undefined;
	node.flags.collapsed = true;
	widget.draw(null, node, null, null);
	node.flags.collapsed = old_collapsed;
	node.size[1] = old_h;
	widget.element.hidden = old_elem_hide;
	widget.element.style.display = old_elem_display;
	if (old_hide)
		widget.options.onHide = old_hide;
	app.canvas.setDirty(true);
}

function setup_dom_resize(node, widget) {
	widget.element.style.resize = "vertical";
	(widget[RESIZE_OBSERVER] = new ResizeObserver(() => {
		widget.element.style.setProperty("--comfy-widget-height", String(Math.max(50, widget.element.offsetHeight + 20)));
		dom_resize_calc(node, widget);
	})).observe(widget.element);
	// [TODO] Prevent resize out of bound and preserve --comfy-widget-height when cloning or configure
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function setup_sole_pin(node, name, side_name, side_mode, shape) {
	const upper_name = side_name.charAt(0).toUpperCase() + side_name.slice(1),
		more_name = side_name + "s";

	lib0246.hijack(node, "onConnect" + upper_name, function () {
		if (this.mark) {
			if (this.self[more_name][arguments[0]].name !== name)
				return true;

			this.self[more_name][arguments[0]].shape = shape;
			this.self[more_name][arguments[0]].type = arguments[2].type;
			this.self[more_name][arguments[0]].name = side_mode === LiteGraph.OUTPUT ? `${arguments[2].type}:${name}` : `${name}:${arguments[2].type}`;
		}
	});

	lib0246.hijack(node, "onConnectionsChange", function (type, index, connected, link_info) {
		if (this.mark) {
			if (link_info === null) {
				// Clean up when copy paste or template load
				if (this.self[more_name])
					for (let i = 0; i < this.self[more_name].length; ++ i)
						if (this.self[more_name][i].name === (
							side_mode === LiteGraph.OUTPUT ?
							`${this.self[more_name][i].type}:${name}` :
							`${name}:${this.self[more_name][i].type}`)
						) {
							this.self[more_name][i].type = "*";
							this.self[more_name][i].name = name;
							break;
						}
				return;
			}
			
			if (
				!connected &&
				index < this.self[more_name].length &&
				this.self[more_name][index].name === (
					side_mode === LiteGraph.OUTPUT ?
					`${this.self[more_name][index].type}:${name}` :
					`${name}:${this.self[more_name][index].type}`
				) &&
				type === side_mode
			) {
				this.self[more_name][index].type = "*";
				this.self[more_name][index].name = name;
			}
		}
	});
}

function expand_y_save(node, off, func) {
	const old_w = node.size[0],
		calc_h = node.size[1] + LiteGraph.NODE_SLOT_HEIGHT * off;
	if (!func()) {
		node.size[0] = old_w;
		if (node.size[1] !== calc_h && node.flex_data)
			node.size[1] = calc_h;
	}
}

function setup_expand(node, kind, real, pin, shape, callback) {
	const raw_name = kind === LiteGraph.INPUT ? "input" : "output",
		upper_name = raw_name.charAt(0).toUpperCase() + raw_name.slice(1),
		more_name = raw_name + "s";

	node["add" + upper_name](pin, "*");

	if (node[more_name])
		for (let i = 0; i < node[more_name].length; ++ i)
			if (node[more_name][i].name === pin) {
				node[more_name][i].shape = shape;
				break;
			}

	lib0246.hijack(node, "configure", function (data) {
		if (this.mark && this.self[more_name])
			for (let i = 0; i < this.self[more_name].length; ++ i) {
				if (!node?.onConnectExpand?.("configure_expand", this.self[more_name][i].name, data, raw_name, i))
					++ real[raw_name];
			}
	});

	lib0246.hijack(node, "onConnect" + upper_name, function (
		this_slot_index,
		other_slot_type,
		other_slot_obj,
		other_node,
		other_slot_index
	) {
		if (this.mark) {
			this.self.__update = true;

			if (
				node?.onConnectExpand?.(`connect_expand_${raw_name}`, this.self[more_name][this_slot_index].name, ...arguments) &&
				this.self[more_name][this_slot_index].name !== pin
			) {
				this.res = true;
				return;
			}

			const res = callback.apply({ self: this.self, name: raw_name, mode: 0 }, arguments);
			if (res === true) {
				this.res = true;
				return;
			}
			if (res === false) {
				this.res = false;
				return;
			}

			expand_y_save(this.self, 1, () => {
				callback.call({ self: this.self, name: raw_name, mode: 1 }, real[raw_name] ++, this.self[more_name][this_slot_index].type, this_slot_index);
				this.self["add" + upper_name](pin, "*");
			});
			this.self[more_name][this.self[more_name].length - 1].shape = shape;

			app.canvas.setDirty(true, false);
			this.res = true;
		}
	});

	lib0246.hijack(node, "onConnectionsChange", function (type, index, connected, link_info) {
		if (this.mark) {
			const args = arguments;
			if (link_info === null) {
				// Clean up when copy paste or template load
				if (this.self[more_name])
					lib0246.remove_elem_arr(
						this.self[more_name],
						(e) => !node?.onConnectExpand?.(`connection_change_remove_expand_${raw_name}`, e.name, e, ...args)
					);
				this.self.computeSize();
				app.canvas.setDirty(true, false);
				return;
			}
			
			if (!connected && type === kind)
				expand_y_save(this.self, -1, callback.bind({ self: this.self, name: raw_name, mode: 2 }, ...args));
		}
	});
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const INIT_MARK = Symbol("init");

export function highway_impl(nodeType, nodeData, app, shape_in, shape_out) {
	nodeType.prototype.onNodeMoved = function () {};

	lib0246.hijack(nodeType.prototype, "onConnectExpand", expand_blacklist_func);

	nodeType.prototype.onNodeCreated = function () {
		init_update(this, "_query");

		const query = this.widgets.find(w => w.name === "_query");

		query.options = query.options ?? {};
		query.options.multiline = true;

		let last_query = "";
		
		lib0246.hijack(this, "configure", function (data) {
			if (this.mark) {
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
			}
		});

		lib0246.hijack(this, "clone", function () {
			if (this.mark) {
				const node = this.res;
				// Clean up when copy paste or template load
				for (let i = 0; i < node.inputs.length; ++ i)
					if (!node?.onConnectExpand?.("clone_highway_input", node.inputs[i].name, i)) {
						node.inputs[i].name = app.graph.extra["0246.__NAME__"][this.self.id]["inputs"][i]["name"];
						node.inputs[i].type = "*";
					}
				for (let i = 0; i < node.outputs.length; ++ i)
					if (!node?.onConnectExpand?.("clone_highway_output", node.outputs[i].name, i)) {
						node.outputs[i].name = app.graph.extra["0246.__NAME__"][this.self.id]["outputs"][i]["name"];
						node.outputs[i].type = "*";
					}
				node.computeSize();
			}
		});

		this.addWidget("button", "Update", null, () => {
			const self = this;

			(async function () {
				let data = await (await fetch(
					window.location.origin + "/0246-parse-highway",
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

			if (this?.onConnectExpand?.("connect_highway_input", this.inputs[this_target_slot_index].name, ...arguments))
				return true;

			if (this.inputs[this_target_slot_index].link !== null) {
				// Prevent premature link kill
				app.graph.links[this.inputs[this_target_slot_index].link].replaced = true;
				return true;
			}
			
			let curr_pin = this.inputs[this_target_slot_index];
			if (app.graph.extra["0246.__NAME__"][this.id]["inputs"][this_target_slot_index]["type"] === "*")
				curr_pin.type = other_origin_slot_obj.type;
			curr_pin.name = `${app.graph.extra["0246.__NAME__"][this.id]["inputs"][this_target_slot_index]["name"]}:${curr_pin.type}`;

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
			
			if (this?.onConnectExpand?.("connect_highway_output", this.outputs[this_origin_slot_index].name, ...arguments))
				return true;

			let curr_pin = this.outputs[this_origin_slot_index];

			if (app.graph.extra["0246.__NAME__"][this.id]["outputs"][this_origin_slot_index]["type"] === "*") {
				if (other_target_node.__outputType) // Reroute
					curr_pin.type = other_target_node.__outputType;
				else if (other_target_node.defaultConnectionsLayout) // Reroute (rgthree)
					// rgthree accept this anyways so whatever since too lazy to properly do graph traversal
					// EDIT: I was wrong, I have to do it, but not here :(
					curr_pin.type = other_target_slot_obj.type; 
				else
					curr_pin.type = other_target_slot_obj.type;
			}

			curr_pin.name = `${curr_pin.type}:${app.graph.extra["0246.__NAME__"][this.id]["outputs"][this_origin_slot_index]["name"]}`;

			return true;
		};

		this.onConnectionsChange = function (type, index, connected, link_info) {
			if (link_info === null) {
				this[INIT_MARK] = true;
				return;
			}

			if (!connected) {
				switch (type) {
					case 1: {
						if (
							this?.onConnectExpand?.("connection_change_remove_highway_input", this.inputs[link_info.target_slot].name, ...arguments) ||
							link_info.replaced
						)
							return;
						const curr_data = app.graph.extra?.["0246.__NAME__"]?.[this.id]?.["inputs"]?.[link_info.target_slot];
						this.inputs[link_info.target_slot].name = curr_data?.["name"] ?? this.inputs[link_info.target_slot].name;
						if (curr_data?.["type"] === "*" || !app.graph.extra["0246.__NAME__"])
							this.inputs[link_info.target_slot].type = "*";
					} break;
					case 2: {
						if (
							this.outputs[link_info.origin_slot].links.length === 0 && 
							!this?.onConnectExpand?.("connection_change_remove_highway_output", this.outputs[link_info.origin_slot].name, ...arguments)
						) {
							const curr_data = app.graph.extra?.["0246.__NAME__"]?.[this.id]?.["outputs"]?.[link_info.origin_slot];
							this.outputs[link_info.origin_slot].name = curr_data?.["name"] ?? this.outputs[link_info.origin_slot].name;
							if (curr_data?.["type"] === "*" || !app.graph.extra["0246.__NAME__"])
								this.outputs[link_info.origin_slot].type = "*";
						}
					} break;
					default: {
						throw new Error("Unsuported type: " + type);
					}
				}
			}
		};

		lib0246.hijack(this, "onAdded", function () {
			if (this.mark && this.self[INIT_MARK]) {
				delete this.self[INIT_MARK];
				this.self.widgets.find(w => w.name === "Update").callback();
				return;
			}
		});

		lib0246.hijack(this, "onRemoved", function () {
			if (!this.mark) {
				app.graph.extra["0246.__NAME__"] = app.graph.extra["0246.__NAME__"] ?? {};
				delete app.graph.extra["0246.__NAME__"][this.self.id];
			}
		});
	};

	lib0246.hijack(nodeType.prototype, "getExtraMenuOptions", function (canvas, options) {
		// canvas === app.canvas
		
		// value: parent submenu obj
		// options: this.extra == node, scroll_speed, event: litegraph event
		// evt: native event object
		// menu
		// node
		if (!this.mark) {
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
		}
	});

	rgthree_exec("addConnectionLayoutSupport", nodeType, app);
}

function save_parse_load_pin(node, shape_in, shape_out, callback) {
	node.__update = true;

	let prev = [];

	// Save previous inputs and outputs
	if (node.inputs) {
		for (let i = 0; i < node.inputs.length; ++ i) {
			if (
				!node?.onConnectExpand?.("save_parse_load_pin_save_input", node.inputs[i].name, i) &&
				node.inputs[i].link !== null
			)
				prev.push({
					flag: false,
					name: app.graph.extra?.["0246.__NAME__"]?.[node.id]?.["inputs"]?.[i]?.["name"] ?? null,
					node_id: app.graph.links[node.inputs[i].link].origin_id,
					slot_id: app.graph.links[node.inputs[i].link].origin_slot,
					this_id: i
				});
		}

		for (let i = node.inputs.length; i -- > 0;) {
			if (!node?.onConnectExpand?.("save_parse_load_pin_remove_input", node.inputs[i].name, i))
				node.removeInput(i);
		}

		callback(node, prev, false);

		for (let i = 0; i < node.inputs.length; ++ i) {
			app.graph.extra["0246.__NAME__"] = app.graph.extra["0246.__NAME__"] ?? {};
			app.graph.extra["0246.__NAME__"][node.id] = app.graph.extra["0246.__NAME__"][node.id] ?? {
				inputs: {},
				outputs: {},
			};
			app.graph.extra["0246.__NAME__"][node.id].inputs[i] = app.graph.extra["0246.__NAME__"][node.id].inputs[i] ?? {};
			app.graph.extra["0246.__NAME__"][node.id].inputs[i].name = node.inputs[i].name;
			app.graph.extra["0246.__NAME__"][node.id].inputs[i].type = node.inputs[i].type;
			if (!node?.onConnectExpand?.("save_parse_load_pin_load_input", node.inputs[i].name, i))
				node.inputs[i].shape = shape_in;
		}
	}

	if (node.outputs) {
		for (let i = 0; i < node.outputs.length; ++ i) {
			if ((
				!node?.onConnectExpand?.("save_parse_load_pin_save_output", node.outputs[i].name, i)
			) && node.outputs[i].links !== null)
				for (let j = 0; j < node.outputs[i].links.length; ++ j)
					prev.push({
						flag: true,
						name: app.graph.extra?.["0246.__NAME__"]?.[node.id]?.["outputs"]?.[i]?.["name"] ?? null,
						node_id: app.graph.links[node.outputs[i].links[j]].target_id,
						slot_id: app.graph.links[node.outputs[i].links[j]].target_slot,
						this_id: i
					});
		}

		for (let i = node.outputs.length; i -- > 0;) {
			if (!node?.onConnectExpand?.("save_parse_load_pin_remove_output", node.outputs[i].name, i))
				node.removeOutput(i);
		}

		callback(node, prev, true);

		for (let i = 0; i < node.outputs.length; ++ i) {
			app.graph.extra["0246.__NAME__"] = app.graph.extra["0246.__NAME__"] ?? {};
			app.graph.extra["0246.__NAME__"][node.id] = app.graph.extra["0246.__NAME__"][node.id] ?? {
				inputs: {},
				outputs: {},
			};
			app.graph.extra["0246.__NAME__"][node.id].outputs[i] = app.graph.extra["0246.__NAME__"][node.id].outputs[i] ?? {};
			app.graph.extra["0246.__NAME__"][node.id].outputs[i].name = node.outputs[i].name;
			app.graph.extra["0246.__NAME__"][node.id].outputs[i].type = node.outputs[i].type;
			if (!node?.onConnectExpand?.("save_parse_load_pin_load_output", node.outputs[i].name, i))
				node.outputs[i].shape = shape_out;
		}
	}

	// Restore previous inputs and outputs
	for (let i = 0; i < prev.length; ++ i) {
		// Check if input/output still exists
		if (prev[i].flag) {
			if (prev[i].name === null)
				node.connect(
					prev[i].this_id,
					prev[i].node_id,
					prev[i].slot_id
				);
			else for (let j = 0; j < node.outputs.length; ++ j) {
				if (app.graph.extra["0246.__NAME__"][node.id]["outputs"][j]["name"].slice(0) === prev[i].name.slice(0)) {
					node.connect(
						j,
						prev[i].node_id,
						prev[i].slot_id
					);
					break;
				}
			}
		} else {
			if (prev[i].name === null)
				app.graph.getNodeById(prev[i].node_id).connect(
					prev[i].slot_id,
					node,
					prev[i].this_id
				);
			else for (let j = 0; j < node.inputs.length; ++ j) {
				if (app.graph.extra["0246.__NAME__"][node.id]["inputs"][j]["name"].slice(1) === prev[i].name.slice(1)) {
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

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function single_impl_input_raw(inst, app, real, shape_in) {
	setup_expand(inst, LiteGraph.INPUT, real, "...", shape_in, function () {
		switch (this.mode) {
			case 0: {
				if (this.self.inputs[arguments[0]].link !== null) {
					app.graph.links[this.self.inputs[arguments[0]].link].replaced = true;
					return true;
				}
				this.self.inputs[arguments[0]].type = arguments[2].type;
			} break;
			case 1: {
				this.self.inputs[arguments[2]].name = this.self?.onNameExpand?.(false, LiteGraph.INPUT, ...arguments) ?? `${arguments[0]}:${arguments[1]}`;
			} break;
			case 2: {
				if (arguments[0] === LiteGraph.INPUT) {
					let link_info = arguments[3];
					if (this.self?.onConnectExpand?.("single_impl_input_remove", this.self.inputs[link_info.target_slot]?.name, ...arguments)) // || link_info.replaced)
						return true;
					link_shift_up(this.self, this.self.inputs, link_info.target_slot, false, arguments);
					-- real.input;
				}
			} break;
		}
	});
}

function single_impl_output_raw(inst, app, real, shape_out) {
	setup_expand(inst, LiteGraph.OUTPUT, real, "...", shape_out, function () {
		switch (this.mode) {
			case 0: {
				// Prevent the case of connecting "..." to "..." to form "0:* 0:*" then connect "..." to "0:*"
				// With the cost of minor inconvenience
				// [TODO] Maybe properly detect if pin belongs to "..."?
				if (arguments[3].inputs[arguments[4]].link)
					return false;

				if (this.self.outputs[arguments[0]].links && this.self.outputs[arguments[0]].links.length > 0)
					return true;
				
				// Avoid node to connect to multiple output while allowing different pins
				for (let i = 0; i < this.self.outputs.length; ++ i) {
					if (this.self?.onConnectExpand?.("single_impl_output_check", this.self.outputs[i].name, ...arguments, i))
						continue;
					let output_node = this.self.getOutputNodes(i);
					if (output_node)
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
				this.self.outputs[arguments[2]].name = this.self?.onNameExpand?.(false, LiteGraph.OUTPUT, ...arguments) ?? `${arguments[1]}:${arguments[0]}`;
			} break;
			case 2: {
				if (arguments[0] === LiteGraph.OUTPUT) {
					let link_info = arguments[3];
					if (this.self?.onConnectExpand?.("single_impl_output_remove", this.self.outputs[link_info.origin_slot]?.name, ...arguments))
						return true;
					if (!this.self.outputs[link_info.origin_slot].links || this.self.outputs[link_info.origin_slot].links.length === 0) {
						link_shift_up(this.self, this.self.outputs, link_info.origin_slot, true, arguments);
						-- real.output;
					}
				}
			} break;
		}
	});
}

export function junction_impl(nodeType, nodeData, app, name, shape_in, shape_out) {
	lib0246.hijack(nodeType.prototype, "onConnectExpand", expand_blacklist_func);
	nodeType.prototype.onNodeCreated = function () {
		if (typeof name === "string")
			init_update(this, name);
		
		if (this.widgets) {
			const offset = this.widgets.find(w => w.name === "_offset");
			if (offset) {
				offset.options = offset.options ?? {};
				offset.options.multiline = true;
			}
		}

		const real = {
			input: 0,
			output: 0,
		};
		
		single_impl_input_raw(this, app, real, shape_in);

		single_impl_output_raw(this, app, real, shape_out);

		lib0246.hijack(this, "getExtraMenuOptions", function (canvas, options) {
			if (!this.mark)
				help_option(nodeType, HELP["junction"], options);
		});
	};
	rgthree_exec("addConnectionLayoutSupport", nodeType, app);
}

export function single_impl_input(nodeType, nodeData, app, shape_in) {
	lib0246.hijack(nodeType.prototype, "onConnectExpand", expand_blacklist_func);
	lib0246.hijack(nodeType.prototype, "onNodeCreated", function () {
		if (this.mark) {
			setup_loop_update(this.self);
			
			single_impl_input_raw(this.self, app, {
				input: 0,
			}, shape_in);
		}
	});
}

export function single_impl_output(nodeType, nodeData, app, shape_out) {
	lib0246.hijack(nodeType.prototype, "onConnectExpand", expand_blacklist_func);
	lib0246.hijack(nodeType.prototype, "onNodeCreated", function () {
		if (this.mark) {
			setup_loop_update(this.self);

			single_impl_output_raw(this.self, app, {
				output: 0,
			}, shape_out);
		}
	});
}

export function single_impl_pin(nodeType, pin_list) {
	lib0246.hijack(nodeType.prototype, "onNodeCreated", function () {
		if (this.mark)
			for (let i = 0; i < pin_list.length; i += 3)
				setup_sole_pin(
					this.self,
					pin_list[i],
					pin_list[i + 1] === LiteGraph.INPUT ? "input" : "output",
					pin_list[i + 1],
					pin_list[i + 2]
				);
	});
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function setup_loop_update(node) {
	if (node.widgets)
		for (let i = 0; i < node.widgets.length; ++ i) {
			if (node.widgets[i].name === "_update") {
				node.widgets.splice(i, 1);
				init_update_direct(node, "_update");
				break;
			}
		}
}

function raw_setup_log(self) {
	self.log_widget = ComfyWidgets["STRING"](self, "output", ["STRING", { multiline: true }], app).widget;
	self.log_widget.inputEl.readOnly = true;
	self.log_widget.serializeValue = async (node, index_str) => {
		if (node.widgets_values)
			node.widgets_values[Number(index_str)] = "";
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

function setup_log_raw(node, history = false) {
	raw_setup_log(node);
	if (history) {
		node.log_history = new lib0246.RingBuffer(30);
		node.log_count = 0;
	}
	node.msgSize = function (event) {
		force_size(node, node.log_widget, false);
	};
	window.setTimeout(() => {
		// https://github.com/failfa-st/failfast-comfyui-extensions/issues/16
		api.addEventListener("ue-message-handler", node.msgSize);
		lib0246.hijack(node, "onRemoved", function () {
			if (this.mark)
				api.removeEventListener("ue-message-handler", node.msgSize);
		});
	}, 0);
}

export function setup_log(node, history = false, force = false) {
	if (force)
		raw_setup_log(node);
	else
		lib0246.hijack(node, "onNodeCreated", function () {
			if (this.mark)
				setup_log_raw(this.self, history);
		});
	lib0246.hijack(node, "onExecuted", function (message) {
		if (this.mark) {
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
		}
	});
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export function process_reroute(node, type) {
	type = type ?? node.widgets[0].value;
	node.size[0] = 100 + type.length * 8;
	node.inputs[0].type = type;
	node.outputs[0].type = type;
	node.__outputType = type;
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function node_mouse_pos(node) {
	return [
		app.canvas.graph_mouse[0] - node.pos[0],
		app.canvas.graph_mouse[1] - node.pos[1],
	];
}

function calc_flex(node, width) {
	node.flex_data = node.flex_data ?? {};
	node.flex_data.share_count = 0;
	node.flex_data.share_weight = [];
	node.flex_data.share_min_h = [];
	node.flex_data.share_max_h = [];
	node.flex_data.off_h = 0;
	node.flex_data.left_h = 0;
	node.flex_data.dom_h = 0; // For native dom widget is supported
	node.flex_data.img_h = node.flex_data.img_h ?? 0;
	for (let i = 0; i < node.widgets.length; ++ i)
		if (node.widgets[i]?.flex) {
			if (node.widgets[i]?.type === "converted-widget")
				continue;
			node.flex_data.share_weight.push(node.widgets[i]?.flex?.share);
			node.flex_data.share_min_h.push(Number.isFinite(node.widgets[i]?.flex?.real_min_h) && node.widgets[i]?.flex?.real_min_h > 0 ? node.widgets[i]?.flex?.real_min_h : null);
			node.flex_data.share_max_h.push(Number.isFinite(node.widgets[i]?.flex?.real_max_h) && node.widgets[i]?.flex?.real_max_h > 0 ? node.widgets[i]?.flex?.real_max_h : null);
			++ node.flex_data.share_count;
			node.widgets[i].flex.index = node.flex_data.share_count - 1;
			node.flex_data.left_h += 4;
		} else
			node.flex_data.off_h += (node.widgets[i]?.computedHeight ?? node.widgets[i]?.computeSize?.(width ?? LiteGraph.NODE_WIDGET_WIDTH)?.[1] ?? LiteGraph.NODE_WIDGET_HEIGHT) + 4;
	node.flex_data.slot_c = Math.max(node.inputs?.length ?? 0, node.outputs?.length ?? 0);
	node.widgets_start_y = node.flex_data.slot_c === 0 ? 14 : null;
	node.flex_data.slot_h = Math.max(1, node.flex_data.slot_c) * LiteGraph.NODE_SLOT_HEIGHT;
	node.flex_data.take_h = node.flex_data.off_h + node.flex_data.left_h + node.flex_data.slot_h + 8 + 6;
	node.size[1] = Math.max(
		node.flex_data.share_min_h.reduce((a, b) => a + b, node.flex_data.take_h + node.flex_data.img_h),
		(app.canvas.resizing_node === node) ? app.canvas.graph_mouse[1] - node.pos[1] : node.size[1]
	);
}

let PROCESS_WIDGET_NODE;

export function widget_flex(node, widget, options = {}) {
	widget.flex = {};

	lib0246.hijack(widget, "mouse", function (event, pos, evt_node) {
		if (!this.mark) {
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
		}
	});

	lib0246.hijack(widget, "draw", function (ctx, draw_node, widget_width, y, widget_height) {
		if (!this.mark) {
			this.self.flex.real_y = y;
			this.self.flex.real_w = widget_width;

			if (draw_node !== node) {
				this.self.flex.hold_draw[0] = this.self.flex.margin_x;
				this.self.flex.hold_draw[1] = this.self.flex.real_y - 2;
				this.self.flex.hold_draw[2] = widget_width - this.self.flex.margin_x * 2;
				this.self.flex.hold_draw[3] = this.self.flex.temp_h - 2;
			} else {
				lib0246.calc_area(
					this.self.flex.margin_x, this.self.flex.margin_head_y, this.self.flex.margin_tail_real_y,
					widget_width, this.self.flex.real_h,
					this.self.flex.real_max_h,
					this.self.flex.ratio, this.self.flex.center, this.self.flex.real_y,
					true, this.self.flex.hold_draw
				);
			}
		}
	});

	lib0246.hijack(widget, "computeSize", function (width) {
		if (!this.mark) {
			this.self.flex.temp_h = 0;
			if (PROCESS_WIDGET_NODE && PROCESS_WIDGET_NODE.isPointInside(app.canvas.graph_mouse[0], app.canvas.graph_mouse[1])) {
				// Intentional double-ifs
				if (PROCESS_WIDGET_NODE !== node) {
					// [TODO] Maybe somehow find a way to use hold_size since it technically more correct
					this.res = [width, this.self.flex.hold_draw[3]];
					this.self.last_y = this.self.flex.real_y + this.self.flex.margin_head_y;
					this.stop = true;
					return;
				}
			}
	
			// Don't ask why how I came up with this. This took a week of brain power.
			this.self.flex.real_y = this.self.flex.real_y ?? 0;
			this.self.flex.margin_tail_real_y = this.self.flex.margin_tail_y;
			this.self.flex.real_max_h = Infinity;
			this.self.flex.real_min_h = this.self.flex.min_h ?? 0;

			// dom_flag = width === undefined
			if (!node.flex_data)
				calc_flex(node, width);
			
			if (!node.imgs || node.widgets.find(_ => _.name === ANIM_PREVIEW_WIDGET))
				node.flex_data.img_h = 0;

			// [TODO] Caching this?
			this.self.flex.real_h = lib0246.calc_spread(
				node.flex_data.share_count,
				node.size[1] - node.flex_data.take_h - node.flex_data.img_h,
				node.flex_data.share_weight,
				node.flex_data.share_min_h,
				node.flex_data.share_max_h
			)[this.self.flex.index];
	
			this.self.flex.temp_h += this.self.flex.real_h;
			this.self.computedHeight = this.self.flex.temp_h;
	
			this.res = [width, this.self.flex.temp_h];
			this.stop = true;
		}
	});

	if (!node.computeSize[lib0246.HIJACK_MARK]) {
		lib0246.hijack(node, "computeSize", function () {
			const node = this.self;
			if (!this.mark) {
				if (!node.size) {
					this.stop = true;
					this.res = [LiteGraph.NODE_MIN_WIDTH, 100];
					return;
				}
				calc_flex(node, node.size[0]);
			}
		});

		lib0246.hijack(node, "setSize", function (size) {
			const node = this.self;
			if (!this.mark && Number.isFinite(node?.flex_data?.force_h)) {
				size[1] = node.flex_data.force_h;
				node.flex_data.force_h = null;
			}
		});

		lib0246.hijack(node, "setSizeForImage", function (force) {
			if (!this.mark) {
				if (!force && this.self.animatedImages) return;
				this.self.flex_data.img_h = 220;
				this.self.flex_data.force_h = this.self.size[1];
			}
		});

		lib0246.hijack(node, "onComputeVisible", function () {
			if (this.mark && node?.flex_data && !node?.flex_data?.init) {
				node.flex_data.init = true;
				this.res = true;
			}
		});
	}

	widget.flex.hold_draw = [];
	widget.flex.hold_mouse = [];
	widget.flex.hold_size = [];

	widget.flex.margin_x = options.margin_x ?? 20;
	widget.flex.margin_head_y = options.margin_head_y ?? 0;
	widget.flex.margin_tail_y = options.margin_tail_y ?? 0;
	widget.flex.min_h = options.min_h ?? 0;
	widget.flex.max_h = options.max_h ?? Infinity;
	widget.flex.ratio = options.ratio ?? 0;
	widget.flex.share = options.share ?? false;
	widget.flex.center = options.center ?? true;

	widget.options = widget.options ?? {};
	widget.options.getHeight = function () {
		return this.self.flex.real_h;
	};
}

const DOM_NODE_DB = new Set(), DOM_RESIZE_MARK = Symbol("dom_resize");

export function DOM_WIDGET(data_type, data_name, element, options = {}) {
	Object.assign(options, {
		hideOnZoom: true,
		selectOn: ["focus", "click"],
	});

	const widget = {
		name: data_name,
		type: data_type,
		get value() {
			return this.options.getValue?.();
		},
		set value(value) {
			this.options.setValue?.(value);
			this.callback?.(value);
		},
		draw: function (ctx, node, widget_width, y, widget_height) {
			const hidden =
				node.flags?.collapsed ||
				(!!options.hideOnZoom && app.canvas.ds.scale < 0.5) ||
				widget.flex.hold_draw[3] <= 0 ||
				widget.type === "converted-widget";
			this.element.hidden = hidden;
			this.element.style.display = hidden ? "none" : "";
			if (hidden) {
				widget.options.onHide?.(widget);
				return;
			}

			const elem_rect = ctx.canvas.getBoundingClientRect(),
				transform = new DOMMatrix()
					.scaleSelf(elem_rect.width / ctx.canvas.width, elem_rect.height / ctx.canvas.height)
					.multiplySelf(ctx.getTransform())
					.translateSelf(widget.flex.hold_draw[0], widget.flex.hold_draw[1]);

			Object.assign(this.element.style, {
				transformOrigin: "0 0",
				transform: new DOMMatrix().scaleSelf(transform.a, transform.d),
				left: `${transform.a + transform.e}px`,
				top: `${transform.d + transform.f}px`,
				width: `${widget.flex.hold_draw[2]}px`,
				height: `${widget.flex.hold_draw[3]}px`,
				position: "absolute",
				zIndex: app.graph._nodes.indexOf(node),
			});

			// [TODO]
			// if (app.ui.settings.getSettingValue("Comfy.DOMClippingEnabled", false)) {
			// 	this.element.style.clipPath = lib0246.clip_path(node, element, elRect);
			// 	this.element.style.willChange = "clip-path";
			// }

			this.options.onDraw?.(widget);
		},
		onAdd(node, flag = false) {
			const widget = this;
			if (!widget.element.parentElement)
				document.body.append(widget.element);

			if (!flag) {
				DOM_NODE_DB.add(node);
				if (widget.element.blur) {
					widget.mouse_dom = function (event) {
						if (!widget.element.contains(event.target))
							widget.element.blur();
					};
					document.addEventListener("mousedown", widget.mouse_dom);
				}

				for (const evt of widget.options.selectOn) {
					widget.element.addEventListener(evt, () => {
						app.canvas.selectNode(node);
						app.canvas.bringToFront(node);
					});
				}

				lib0246.hijack(node, "collapse", function () {
					if (this.mark && this.self.flags?.collapsed) {
						widget.element.hidden = true;
						widget.element.style.display = "none";
					}
				});

				lib0246.hijack(node, "onRemoved", function () {
					// widget.element.remove();
					if (!this.mark) {
						widget.onRemove();
						DOM_NODE_DB.delete(this.self);
					}
				});

				if (!node[DOM_RESIZE_MARK]) {
					node[DOM_RESIZE_MARK] = true;
					lib0246.hijack(node, "onResize", function (size) {
						if (this.mark) {
							widget.options.beforeResize?.call(widget, this);
							widget.computeSize(size[0]);
							widget.options.afterResize?.call(widget, this);
						}
					});
				}
			}
		},
		onRemove(flag = false) {
			if (this.mouse_dom && !flag)
				document.removeEventListener("mousedown", this.mouse_dom);
			this.element.remove();
		},
		element,
		options,
	};

	return widget;
}

lib0246.hijack(LGraphNode.prototype, "addDOMWidget", function (name, type, element, options = {}) {
	if (!this.mark && app.ui.settings.getSettingValue("0246.AlternateDOMWidget", false)) {
		options.flex = options.flex ?? {};
		options.flex.ratio = options?.flex?.ratio ?? 0;
		options.flex.share = options?.flex?.share ?? 1;
		options.flex.min_h = options?.flex?.min_h ?? 30;
		options.flex.center = options?.flex?.center ?? true;
		options.flex.margin_x = options?.flex?.margin_x ?? 10;

		const widget = DOM_WIDGET(type, name, element, options);
		this.self.addCustomWidget(widget);
		widget_flex(this.self, widget, options.flex);
		widget.onAdd(this.self, false);
		widget.options.flex = options.flex;
		this.stop = true;
		this.res = widget;
	}
});

lib0246.hijack(LGraphCanvas.prototype, "computeVisibleNodes", function () {
	if (this.mark)
		for (const node of app.graph._nodes) {
			if (node?.onComputeVisible?.())
				this.res.push(node);
			if (node.flex_data || DOM_NODE_DB.has(node)) {
				const hidden = this.res.indexOf(node) === -1 || node.flags?.collapsed;
				for (const w of node.widgets)
					if (w.element) {
						w.element.hidden = hidden;
						w.element.style.display = hidden ? "none" : "";
						if (hidden)
							w.options.onHide?.(w);
					}
			}
		}
});

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function eval_state(db, state, node, widget, event, pos) {
	for (let i = 0; i < db.length; i += 2) {
		if (Array.isArray(db[i])) {
			for (let j = 0; j < db[i].length; ++ j)
				if (lib0246.equal_dict(state, db[i][j], true, "*")) {
					lib0246.update_dict(state, db[i + 1](node, widget, event, pos) ?? {});
					return;
				}
			continue;
		} else if (lib0246.equal_dict(state, db[i], true, "*")) {
			lib0246.update_dict(state, db[i + 1](node, widget, event, pos) ?? {});
			return;
		}
	}
}

function reset_state(state) {
	delete state.mouse;
	delete state.where;
	delete state.action;
	delete state.select;
	delete state.bound;
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

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
		reset_state(widget.box_range.state);
		widget.box_range.select.length = 0;
		widget.box_range.begin_state = null;
		widget.box_range.during_state = null;
		widget.box_range.select_during = null;
		widget.box_range.delay_state = null;
	}
];

const NODE_COLOR_LIST = Object.keys(LGraphCanvas.node_colors);

export function BOX_RANGE_WIDGET(data_type, data_name, options = {}) {
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
			ctx.clip();
			ctx.stroke();
			ctx.fill();
			ctx.closePath();

			if (!this?.options?.hideOnZoom || app.canvas.ds.scale >= 0.5) {
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

			eval_state(BOX_RANGE_STATE, widget.box_range.state, node, widget, event, pos);
		},
	};

	widget.box_range = widget.box_range ?? {};
	widget.box_range.boxes = widget.box_range.boxes ?? [];
	widget.box_range.select = widget.box_range.select ?? [];

	widget.box_range.delay_dbl = widget.box_range.delay_dbl ?? options.delay_dbl ?? 200;
	widget.box_range.radius = widget.box_range.radius ?? options.radius ?? 15;

	widget.row_count = options.row_count ?? 20;
	widget.col_count = options.col_count ?? 20;

	return widget;
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

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

function draw_number_lock(widget, ctx, x, y, widget_width, widget_height, left_margin, right_margin, text_margin, lock_margin, text_raw, text_real, lock, text_flag) {
	ctx.textAlign = "left";
	ctx.strokeStyle = LiteGraph.WIDGET_OUTLINE_COLOR;
	ctx.fillStyle = LiteGraph.WIDGET_BGCOLOR;
	ctx.save();
	ctx.beginPath();
	if (text_flag)
		ctx.roundRect(x + left_margin + lock_margin, y, widget_width - left_margin - right_margin - lock_margin, widget_height, [widget_height * 0.5]);
	else
		ctx.rect(x + left_margin + lock_margin, y, widget_width - left_margin - right_margin - lock_margin, widget_height);
	ctx.clip();
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
		ctx.fillText(`${widget.label ?? widget.name} (${text_real})`, x + left_margin + text_margin + lock_margin + 5, y + widget_height * 0.7);
		ctx.fillStyle = LiteGraph.WIDGET_TEXT_COLOR;
		ctx.textAlign = "right";
		ctx.fillText(
			text_raw,
			x + widget_width - right_margin - text_margin - 20,
			y + widget_height * 0.7
		);
	}
	ctx.restore();
	draw_lock(ctx, x + left_margin, y, widget_height, widget_height, lock);
}

function ratio_process_calc(widget, mode, old_value) {
	const data = widget.value.data,
		lock = widget.value.lock,
		opt = widget.options;
	switch (Math.abs(mode)) {
		case 1: {
			if (lock.height && lock.width && lock.ratio) {
				data.height = old_value * data.height / data.width;
				if (data.height < opt.min) {
					data.height = opt.min;
					data.width = data.height * data.ratio;
				} else if (data.height > opt.max) {
					data.height = opt.max;
					data.width = data.height * data.ratio;
				}
				data.ratio = data.width / data.height;
			} else if (lock.height && !lock.ratio) {
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
			if (lock.height && lock.width && lock.ratio) {
				data.width = old_value * data.width / data.height;
				if (data.width < opt.min) {
					data.width = opt.min;
					data.height = data.width / data.ratio;
				} else if (data.width > opt.max) {
					data.width = opt.max;
					data.height = data.width / data.ratio;
				}
				data.ratio = data.width / data.height;
			} else if (lock.width && !lock.ratio) {
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
			if (
				(lock.height && lock.width && lock.ratio) ||
				(!lock.height && !lock.width && !lock.ratio)
			) {
				data.ratio = old_value;
			} else if (!lock.height && lock.width) {
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

function ratio_notify(node, widget, name, mode, old_value, value, pos, event, w_f, h_f) {
	if (/^[0-9+\-*/()\s]+|\d+\.\d+$/.test(value))
		try {
			const res = Number(eval(value));
			if (w_f) {
				widget.value.data.width = res / widget.value.data.height;
				if (widget.value.data.width < widget.options.min) {
					widget.value.data.width = widget.options.min;
					widget.value.data.height = widget.value.data.width / widget.value.data.ratio;
				} else if (widget.value.data.width > widget.options.max) {
					widget.value.data.width = widget.options.max;
					widget.value.data.height = widget.value.data.width / widget.value.data.ratio;
				}
				widget.value.data.ratio = widget.value.data.width / widget.value.data.height;
				app.canvas.setDirty(true);
			} else if (h_f) {
				widget.value.data.height = res / widget.value.data.width;
				if (widget.value.data.height < widget.options.min) {
					widget.value.data.height = widget.options.min;
					widget.value.data.width = widget.value.data.height * widget.value.data.ratio;
				} else if (widget.value.data.height > widget.options.max) {
					widget.value.data.height = widget.options.max;
					widget.value.data.width = widget.value.data.height * widget.value.data.ratio;
				}
				widget.value.data.ratio = widget.value.data.width / widget.value.data.height;
				app.canvas.setDirty(true);
			} else {
				widget.value.data[name] = res;
				ratio_process_calc(widget, mode, old_value);
			}
			if (widget.options && widget.options.property && node.properties[widget.options.property] !== undefined)
				node.setProperty(widget.options.property, value);
			widget?.callback?.(widget.value, widget, node, pos, event);
		} catch (e) {}
}

export function RATIO_WIDGET(data_type, data_name, options = {}) {
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

			draw_number_lock(
				this, ctx, 0, y, calc_width, widget_height, margin, 0, text_margin, lock_margin,
				lib0246.floor(widget.value.data.width, widget.options.precision ?? 3),
				`W: ${lib0246.snap(widget.value.data.width, widget.options.snap)}`,
				widget.value.lock.width, show_text
			);
			draw_number_lock(
				this, ctx, calc_width, y, calc_width, widget_height, 0, 0, text_margin, lock_margin,
				lib0246.floor(widget.value.data.ratio, widget.options.precision ?? 3),
				`A: ${lib0246.floor(widget.value.data.width * widget.value.data.height, widget.options.precision ?? 3)}`,
				widget.value.lock.ratio, show_text
			);
			draw_number_lock(
				this, ctx, calc_width * 2, y, calc_width, widget_height, 0, margin, text_margin, lock_margin,
				lib0246.floor(widget.value.data.height, widget.options.precision ?? 3),
				`H: ${lib0246.snap(widget.value.data.height, widget.options.snap)}`,
				widget.value.lock.height, show_text
			);

			ctx.restore();
		},
		mouse: function (event, pos, node) {
			const margin = 15,
				lock_margin = 20,
				text_margin = 15,
				calc_width = this.temp_w / 3,
				hit_width = 20;

			let mode = 0, old_value;

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
						if (!this.drag_flag) {
							const w_f = this.value.lock.ratio && this.value.lock.width && this.value.lock.height,
								h_f = !this.value.lock.ratio && !this.value.lock.width && !this.value.lock.height;
							app.canvas.prompt(w_f ? "Area (width)" : h_f ? "Area (height)" : "Ratio", this.value.data.ratio, (value) => ratio_notify(
								node, this, "ratio", mode, old_value, value, pos, event, w_f, h_f
							), event);
						} else
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

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export function SPACE_TITLE_WIDGET() {
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

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const HUB_WIDGET_PIN = Symbol("widget_pin");

export function hub_combo_pin_type_func(value, canvas, node, pos, event) {
	if (this[HUB_WIDGET_PIN].type !== "COMBO")
		this[HUB_WIDGET_PIN].type = value;
	for (let i = 0; this[HUB_WIDGET_PIN].links && i < this[HUB_WIDGET_PIN].links.length; ++ i) {
		const link = app.graph.links[this[HUB_WIDGET_PIN].links[i]],
			target_node = app.graph.getNodeById(link.target_id),
			pin = target_node.inputs[link.target_slot];
		if (!(pin.type === value || pin.type === "*"))
			target_node.disconnectInput(link.target_slot);
	}
}

export const HUB_SOLE = 7;

async function hub_serialize_batch_combo(node, index_str) {
	return node.widgets[Number(index_str)].value.join(":");
}

export const PIPE_COMBO = ["HIGHWAY_PIPE", "JUNCTION_PIPE"];

export function hub_setup_widget(node, data, id) {
	for (let node_id of app.graph.extra["0246.HUB_DATA"][id].node_list)
		node.hubPushNode(app.graph.getNodeById(node_id), true);

	if (node.outputs && node.outputs.length > 0) {
		let count = 0, widget;
		for (let name in node.hub.data.sole_type) {
			const proc_name = node.hub.data.sole_type[name], // name.split(":"),
				type_data = proc_name.slice(3, 6);
			switch (proc_name[2]) {
				case "int": {
					widget = node.hubPushWidgetPrim("INT", type_data, name);
				} break;
				case "float": {
					widget = node.hubPushWidgetPrim("FLOAT", type_data, name);
				} break;
				case "string": {
					widget = node.hubPushWidgetPrim("STRING", type_data, name);
				} break;
				case "boolean": {
					widget = node.hubPushWidgetPrim("BOOLEAN", type_data, name);
				} break;
				case "combo": {
					switch (proc_name[3]) {
						case "__BATCH_PRIM__": {
							widget = node.hubPushWidgetComboRaw(type_defs, proc_name[3], hub_combo_pin_type_func, type_data, name);
						} break;
						case "__BATCH_COMBO__": {
							widget = node.hubPushWidgetComboRaw(combo_defs, proc_name[3], hub_combo_pin_type_func, type_data, name, hub_serialize_batch_combo);
						} break;
						case "__PIPE__": {
							widget = node.hubPushWidgetComboRaw(PIPE_COMBO, proc_name[3], hub_combo_pin_type_func, type_data, name);
						} break;
						default: {
							widget = node.hubPushWidgetCombo(...type_data, name);
						} break;
					}
				} break;
			}
			widget.value = data.widgets_values[HUB_SOLE + 2 + (count ++)];
		}
	}
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function cloud_inst_query_group(group_curr, group_dict, group_list, inst_id) {
	let stack = [];
	for (let ii = 0; ii < group_list.length; ++ ii)
		if (group_dict[group_list[ii]]?.inst?.includes?.(inst_id)) {
			group_curr.push(group_list[ii]);
			stack.push(group_list[ii]);
		}
	cloud_group_query_group(group_curr, group_dict, group_list, stack);
	return group_curr;
}

function cloud_group_query_inst(inst_curr, group_dict, group_id) {
	let stack = [group_id];
	while (stack.length > 0) {
		const temp = group_dict[stack.pop()];
		if (temp?.inst)
			inst_curr.push(...temp.inst);
		if (temp?.group)
			stack.push(...temp.group);
	}
	return inst_curr;
}

function cloud_group_query_group(group_curr, group_dict, group_list, group_stack) {
	const seen = new Set();
	if (!Array.isArray(group_stack))
		group_stack = [group_stack];
	while (group_stack.length > 0) {
		const temp = group_stack.pop();
		for (let ii = 0; ii < group_list.length; ++ ii)
			if (group_dict[group_list[ii]]?.group?.includes?.(temp) && !seen.has(group_list[ii])) {
				group_curr.push(group_list[ii]);
				group_stack.push(group_list[ii]);
				seen.add(group_list[ii]);
			}
	}
	return group_curr;
}

function shelf_layout(
	inst_arr, group_dict, mouse, pos_dict, view_dict, hit_dict, row_arr, curr_dict,
	ctx, x, y, width, height,
	padding_top, padding_bottom, padding_left, padding_right,
	group_padding_top, group_padding_bottom, group_padding_left, group_padding_right,
	margin_top, margin_bottom, margin_left, margin_right,
	width_spacing, height_spacing
) {
	let
		acc_i = 0, acc_w = 0, acc_h = 0, max_h = 0, total_h = 0,
		group_y = 0, text_max_h = 0,
		hold = [], flag = false, mouse_flag = true, old_id;

	const key_list = [],
		group_list = Object.keys(group_dict),
		pos_list = Object.keys(pos_dict);

	for (let i = 0; i < inst_arr.length; ++ i)
		key_list.push(inst_arr[i].id);

	for (let i = 0; i < pos_list.length; ++ i) {
		delete pos_dict[pos_list[i]];
		delete hit_dict[pos_list[i]];
	}

	curr_dict.x = null;
	curr_dict.y = null;
	curr_dict.h = null;
	curr_dict.i = null;
	curr_dict.k = null;

	row_arr.length = 0;

	for (let i = 0; i < key_list.length; ++ i) {
		const text_data = ctx.measureText(view_dict[key_list[i]]);
		text_max_h = Math.max(text_max_h, text_data.actualBoundingBoxAscent + text_data.actualBoundingBoxDescent);
	}

	for (let i = 0; i < key_list.length; ++ i) {
		acc_i = i;
		acc_w = 0;
		max_h = 0;
		group_y = 0;
		for (; i < key_list.length; ++ i) {
			let group_curr = [];
			cloud_inst_query_group(group_curr, group_dict, group_list, key_list[i]);
			
			const text_data = ctx.measureText(view_dict[key_list[i]]);

			group_y = Math.max(group_y, group_padding_top * group_curr.length);

			hit_dict[key_list[i]] = [
				x + acc_w, y + acc_h,
				margin_left + group_padding_left * group_curr.length + padding_left +
					text_data.width +
					padding_right + group_padding_right * group_curr.length + margin_right
			];

			const temp_h = margin_top + group_y + padding_top +
				text_max_h + 
				padding_bottom + group_padding_bottom * group_curr.length + margin_bottom;
			
			max_h = Math.max(max_h, temp_h);

			if (flag || lib0246.is_inside_rect_rect(
				x + acc_w, y + acc_h, hit_dict[key_list[i]][2], temp_h,
				x, y, width, height
			)) {
				hold.push(
					key_list[i],
					acc_w + margin_left, acc_h + margin_top,
					text_data, group_curr
				);

				acc_w += hit_dict[key_list[i]][2] + width_spacing;

				flag = false;
			} else {
				if (hold.length === 0) {
					-- i;
					flag = true;
					continue;
				}

				acc_h += max_h + height_spacing;

				if (old_id !== key_list[i]) {
					old_id = key_list[i];
					-- i;
				}
				break;
			}
		}
		
		// 	hold, text_max_h, group_y,
		// 	mouse, pos_dict,
		// 	padding_top, padding_bottom, padding_left, padding_right,
		// 	group_padding_top, group_padding_bottom, group_padding_left, group_padding_right,

		row_arr.push(max_h);

		for (let ii = 0; ii < hold.length; ii += 5) {
			let temp_text_x = hold[ii + 1] + group_padding_left * hold[ii + 4].length,
				temp_text_y = hold[ii + 2] + group_y;

			pos_dict[hold[ii]] = [
				temp_text_x + hold[ii + 3].width / 2 + padding_left,
				temp_text_y + text_max_h / 2 + padding_top,

				temp_text_x + hold[ii + 3].width / 2 - hold[ii + 3].actualBoundingBoxLeft,
				temp_text_y + text_max_h / 2 - hold[ii + 3].actualBoundingBoxAscent,
				hold[ii + 3].width + padding_left + padding_right,
				text_max_h + padding_top + padding_bottom,
			];

			hit_dict[hold[ii]][3] = row_arr[row_arr.length - 1];

			let temp_group_x = pos_dict[hold[ii]][2] - group_padding_left,
				temp_group_y = pos_dict[hold[ii]][3] - group_padding_top,
				temp_group_w = pos_dict[hold[ii]][4] + group_padding_left + group_padding_right,
				temp_group_h = pos_dict[hold[ii]][5] + group_padding_top + group_padding_bottom;

			for (let iii = 0; iii < hold[ii + 4].length; ++ iii) {
				pos_dict[hold[ii]].push(
					hold[ii + 4][iii],
					temp_group_x, temp_group_y, temp_group_w, temp_group_h
				);
				temp_group_x -= group_padding_left;
				temp_group_y -= group_padding_top;
				temp_group_w += group_padding_left + group_padding_right;
				temp_group_h += group_padding_top + group_padding_bottom;
			}
		}

		if (Array.isArray(mouse) && mouse[1] - y < row_arr.reduce((a, b) => a + b + height_spacing, 0) && mouse_flag) {
			let snap_index = lib0246.multi_snap(mouse[0], hold.length / 5 + 1, function (index) {
				if (index === hold.length / 5)
					return hit_dict[hold[(index - 1) * 5]][0] + hit_dict[hold[(index - 1) * 5]][2] + width_spacing;
				return hit_dict[hold[index * 5]][0];
			});
			if (snap_index !== null) {
				if (snap_index === hold.length / 5) {
					curr_dict.x = hit_dict[hold[(snap_index - 1) * 5]][0] + hit_dict[hold[(snap_index - 1) * 5]][2] + width_spacing;
					curr_dict.y = hit_dict[hold[(snap_index - 1) * 5]][1];
				} else {
					curr_dict.x = hit_dict[hold[snap_index * 5]][0];
					curr_dict.y = hit_dict[hold[snap_index * 5]][1];
					curr_dict.k = hold[snap_index * 5];
				}
				curr_dict.h = row_arr[row_arr.length - 1];
				curr_dict.i = acc_i + snap_index;
				curr_dict.r = row_arr.length - 1;
			}
			mouse_flag = false;
		}

		hold.length = 0;
		total_h = Math.max(max_h, total_h);
	}

	return total_h;
}

export const CLOUD_MARK = Symbol("cloud_mark");
const CLOUD_FILL = ["#292929", "#303030"];

const CLOUD_STATE = [
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
			}, {
				mouse: "pointermove",
				action: "select",
				bound: "in"
			}
		], function (node, widget, event, pos) {
			if (widget.cloud.state.mouse === "pointermove")
				widget.cloud.mouse_move = pos;
			if (event.shiftKey && widget.cloud.select.size > 0) {
				if (widget.cloud.mouse_shift !== null)
					widget.cloud.mouse_shift = null;
				else
					return {
						action: "shift"
					};
			} else for (let inst_id in widget.cloud.data.hit)
				if (lib0246.is_inside_rect(
					pos[0], pos[1],
					widget.cloud.data.hit[inst_id][0], widget.cloud.data.hit[inst_id][1],
					widget.cloud.data.hit[inst_id][2], widget.cloud.data.hit[inst_id][3]
				)) {
					if (inst_id === widget.cloud.select_active && widget.cloud.state.where === "box" && widget.cloud.state.mouse === "pointermove")
						continue;
					if (widget.cloud.select.has(inst_id)) {
						widget?.select(node, inst_id, false);
						widget.cloud.select.delete(inst_id);
					} else {
						widget?.select(node, inst_id, true);
						widget.cloud.select.add(inst_id);
					}
					widget.cloud.select_active = inst_id;
				}
			return {
				action: "select"
			};
		},

		{
			mouse: "pointermove",
			action: "shift",
			bound: "in"
		}, function (node, widget, event, pos) {
			if (widget.cloud.state.mouse === "pointermove")
				widget.cloud.mouse_move = pos;
			if (event.shiftKey)
				widget.cloud.mouse_shift = pos;
			else {
				return {
					action: "select"
				};
			}
		},

		{
			mouse: "pointerup",
			action: "shift",
			bound: "in"
		}, function (node, widget, event, pos) {
			if (widget.cloud.data.curr.i !== null) {
				widget.cloud.data.inst.splice(widget.cloud.data.curr.i, 0, CLOUD_MARK);

				let temp = [], indices = [];
				for (let i = 0; i < widget.cloud.data.inst.length; ++ i)
					if (widget.cloud.select.has(widget.cloud.data.inst[i].id)) {
						temp.push(widget.cloud.data.inst[i]);
						indices.push(i);
					}

				for (let i = indices.length - 1; i >= 0; i --)
					widget.cloud.data.inst.splice(indices[i], 1);

				widget.cloud.data.inst.splice(widget.cloud.data.inst.indexOf(CLOUD_MARK), 1, ...temp);
			}

			return {
				action: "select"
			};
		},

		{
			mouse: "pointerdown",
			where: "box",
			action: "move",
			bound: "in"
		}, function (node, widget, event, pos) {
			return {
				action: ""
			};
		},

		{
			mouse: "pointerdown",
			where: "",
			action: "select",
			bound: "in"
		}, function (node, widget, event, pos) {
			for (let inst_id of widget.cloud.select)
				widget?.select(node, inst_id, false);
			widget.cloud.select.clear();
			widget.cloud.select_active = null;
			return {
				action: ""
			};
		},

		{
			mouse: "pointerup",
			// action: "select",
			bound: "in"
		}, function (node, widget, event, pos) {
			widget.cloud.mouse_move = null;
		},

		{
			mouse: "pointermove",
			bound: "in"
		}, function (node, widget, event, pos) {
			widget.cloud.mouse_move = pos;
		},
	],

	{}, function (node, widget, event, pos) {
		reset_state(widget.cloud.state);
		for (let inst_id of widget.cloud.select)
			widget?.select(node, inst_id, false);
		widget.cloud.select.clear();
		widget.cloud.select_active = null;
		widget.cloud.delay_state = null;
		widget.cloud.mouse_shift = null;
		widget.cloud.mouse_move = null;
	}
];

function cloud_rand_func(value, canvas, node, pos, evt) {
	if (value === "seed") {
		node.widgets.find(_ => _.name === `${this.name.split(":").slice(0, -2).join(":")}:rand:seed`).value =
			lib0246.rand_int(-1125899906842624, 1125899906842624);
		this.value = "fix";
	}
}

function cloud_after_func(node, inst_id, step) {
	switch (this.value) {
		case "rand": {
			this.value = lib0246.rand_int(-1125899906842624, 1125899906842624);
		} break;
		case "add": {
			this.value += step ? step.value : this.cloud.widgets[inst_id][1].options.step / 10;
		} break;
		case "sub": {
			this.value -= step ? step.value : this.cloud.widgets[inst_id][1].options.step / 10;
		} break;
		case "fix": {
			// Nothing
		} break;
	}
}

function cloud_widget_build_basic(node, widget, inst_id, name, input, data) {
	if (input !== null && input.find(_ => _.name === name)) {
		node.widgets.push(widget.cloud.widgets[inst_id][0]);
		window.setTimeout(() => {
			node.widgets.splice(
				node.widgets.indexOf(widget.cloud.widgets[inst_id][0]),
				widget.cloud.widgets[inst_id].length
			);
		}, 0);
	}
	if (data !== null)
		for (let i = 0; i < widget.cloud.widgets[inst_id].length; ++ i)
			widget.cloud.widgets[inst_id][i].value = data.widgets_values[i][0];
}

function cloud_widget_select_basic(node, inst_id, name, flag) {
	if (flag) {
		if (node.widgets.findIndex(_ => _.name === name) === -1)
			node.widgets.push(...this.cloud.widgets[inst_id]);
	} else
		node.widgets.splice(
			node.widgets.indexOf(this.cloud.widgets[inst_id][0]),
			this.cloud.widgets[inst_id].length
		);
}

function cloud_widget_view_text_basic(inst, mark = "", snip = true) {
	const text = [];
	for (let i = 0; i < this.cloud.widgets[inst.id].length; ++ i)
		text.push(
			this.cloud.widgets[inst.id][i].type === "converted-widget" ?
			`~${i}~` :
			lib0246[snip ? "text_snip" : "dummy"](String(this.cloud.widgets[inst.id][i].value), 8),
		);
	return text.join(mark);
}

function cloud_build(node, kind, data = null, input = null, full = null) {
	const inst_id = data?.id ?? String(this.cloud.data.id ++),
		hold_inst = data === null ? {
			id: inst_id,
			kind: kind,
			widgets_values: [],
			widgets_names: [],
		} : this.cloud.data.inst.find(_ => _.id === inst_id),
		name = this.name.slice(6);
	switch (kind) {
		case "text": {
			this.cloud.widgets[inst_id] = [
				ComfyWidgets["STRING"](node, `cloud:${name}:${inst_id}:text:text_input`, ["STRING", {
					multiline: true,
				}], app).widget
			];

			if (
				input !== null &&
				input.find(_ => _.name === `cloud:${name}:${inst_id}:text:text_input`)
			)
				window.setTimeout(() => {
					node.widgets.splice(node.widgets.indexOf(this.cloud.widgets[inst_id][0]), 1);
				}, 0);
			else
				node.widgets.splice(node.widgets.length - 1, 1);

			if (data !== null)
				this.cloud.widgets[inst_id][0].options.setValue(data.widgets_values[0][0]);
		} break;
		case "text_list": {
		} break;
		case "text_file_list": {
			// [TODO] For this during viewing, there should be a cache system to maybe open a websocket to return file content
			// Can have a string combo directly to each line
		} break;
		case "text_file_json": {
			// Same cache thing here
			// Use path to get specific string, then the string combo will be available just like above
		} break;
		case "weight": {
			this.cloud.widgets[inst_id] = [
				{
					name: `cloud:${name}:${inst_id}:weight:weight_input`,
					type: "slider",
					value: 1,
					options: {
						// min: Number.MIN_VALUE,
						// max: Number.MAX_VALUE,
						min: -2,
						max: 4,
						step: 0.1,
						precision: 2
					},
				}
			];
			cloud_widget_build_basic(node, this, inst_id, `cloud:${name}:${inst_id}:weight:weight_input`, input, data);
		} break;
		case "rand": {
			this.cloud.widgets[inst_id] = [
				{
					name: `cloud:${name}:${inst_id}:rand:seed`,
					type: "number",
					value: 0,
					options: {
						min: -1125899906842624,
						max: 1125899906842624,
						step: 10,
						precision: 0
					},
				}, {
					name: `cloud:${name}:${inst_id}:rand:count`,
					type: "number",
					value: 1,
					options: {
						min: 1,
						max: Number.MAX_SAFE_INTEGER,
						step: 10,
						precision: 0
					},
				}, {
					name: `cloud:${name}:${inst_id}:rand:order`,
					type: "toggle",
					value: false,
					options: {
						on: true,
						off: false,
					}
				}, {
					name: `cloud:${name}:${inst_id}:rand:mode`,
					type: "combo",
					value: "rand",
					callback: cloud_rand_func,
					afterQueued: cloud_after_func.bind(this, node, inst_id),
					options: {
						// Allow serialize for server-side generation
						values: ["seed", "fix", "rand", "add", "sub"],
					},
				}
			];
			cloud_widget_build_basic(node, this, inst_id, `cloud:${name}:${inst_id}:rand:seed`, input, data);
		} break;
		case "cycle": {
			this.cloud.widgets[inst_id] = [
				{
					name: `cloud:${name}:${inst_id}:cycle:offset`,
					type: "number",
					value: 0,
					options: {
						min: Number.MIN_SAFE_INTEGER,
						max: Number.MAX_SAFE_INTEGER,
						step: 10,
						precision: 0
					},
				}, {
					name: `cloud:${name}:${inst_id}:cycle:step`,
					type: "number",
					value: 0,
					options: {
						min: Number.MIN_SAFE_INTEGER,
						max: Number.MAX_SAFE_INTEGER,
						step: 10,
						precision: 0
					},
				}, {
					name: `cloud:${name}:${inst_id}:cycle:space`,
					type: "number",
					value: 0,
					options: {
						min: Number.MIN_SAFE_INTEGER,
						max: Number.MAX_SAFE_INTEGER,
						step: 10,
						precision: 0
					},
				}, {
					name: `cloud:${name}:${inst_id}:cycle:count`,
					type: "number",
					value: 1,
					options: {
						min: 1,
						max: Number.MAX_SAFE_INTEGER,
						step: 10,
						precision: 0
					},
				}
			];
			this.cloud.widgets[inst_id][3].afterQueued = cloud_after_func.bind(this, node, inst_id, this.cloud.widgets[inst_id][1]);
			cloud_widget_build_basic(node, this, inst_id, `cloud:${name}:${inst_id}:cycle:offset`, input, data);
		} break;
		case "pin": {
			let pin_count = 0;
			for (let i = 0; i < this.cloud.data.inst.length; ++ i)
				if (this.cloud.data.inst[i].kind === "pin")
					++ pin_count;
			hold_inst.widgets_values[0] = hold_inst.widgets_values[0] ?? pin_count;
		} break;
		case "merge": {
			this.cloud.widgets[inst_id] = [
				{
					"name": `cloud:${name}:${inst_id}:merge:delimiter`,
					"type": "string",
					"value": ", ",
					"options": {
						"multiline": true
					}
				}
			];
			cloud_widget_build_basic(node, this, inst_id, `cloud:${name}:${inst_id}:merge:delimiter`, input, data);
		} break;
		default: {
			this.options?.build?.(node, kind, data);
		} break;
	}
	if (data === null)
		this.cloud.data.inst.push(hold_inst);

	return hold_inst;
}

function cloud_select(node, inst_id, flag) {
	const inst = this.cloud.data.inst.find(_ => _.id === inst_id), name = this.name.slice(6);
	switch (inst.kind) {
		case "text": {
			if (flag) {
				if (node.widgets.findIndex(_ => _.name === `cloud:${name}:${inst_id}:text:text_input`) === -1)
					node.widgets.push(this.cloud.widgets[inst_id][0]);
				this.cloud.widgets[inst_id][0].onAdd(node, true);
			} else {
				node.widgets.splice(node.widgets.indexOf(this.cloud.widgets[inst_id][0]), 1);
				this.cloud.widgets[inst_id][0].onRemove(node, true);
			}
		} break;
		case "weight": {
			cloud_widget_select_basic.call(this, node, inst_id, `cloud:${name}:${inst_id}:weight:weight_input`, flag);
		} break;
		case "rand": {
			cloud_widget_select_basic.call(this, node, inst_id, `cloud:${name}:${inst_id}:rand:seed`, flag);
		} break;
		case "cycle": {
			cloud_widget_select_basic.call(this, node, inst_id, `cloud:${name}:${inst_id}:cycle:offset`, flag);
		} break;
		case "merge": {
			cloud_widget_select_basic.call(this, node, inst_id, `cloud:${name}:${inst_id}:merge:delimiter`, flag);
		} break;
		default: {
			this.options?.select?.(node, inst_id, flag);
		}	break;
	}
	node.computeSize();
}

function cloud_view(node, inst) {
	let text = "", old_text = text; // [${inst.kind},${inst.id}]
	switch (inst.kind) {
		case "text": {
			text += this.cloud.widgets[inst.id][0].type === "converted-widget" ?
				`~0~` :
				this.cloud.widgets[inst.id][0].options.getValue();
		} break;
		case "weight": {
			text = this.cloud.widgets[inst.id][0].type === "converted-widget" ?
				`~0~` :
				String(lib0246.round(this.cloud.widgets[inst.id][0].value, 2));
		} break;
		case "rand": {
			text = cloud_widget_view_text_basic.call(this, inst, " ");
		} break;
		case "cycle": {
			text = cloud_widget_view_text_basic.call(this, inst, " ");
		} break;
		case "pin": {
			text = `!${inst.widgets_values[0]}!`;
		} break;
		case "merge": {
			text = `|${cloud_widget_view_text_basic.call(this, inst, "", false)}|`;
		} break;
		default: {
			text += this.options?.view?.(node, inst);
		} break;
	}
	// [TODO] If converted to pin then display as such
	if (text === old_text)
		text += "[...]";
	return text;
}

function cloud_remove_handler(widget, node, inst_id, index) {
	for (let i = 0; i < node.inputs.length; ++ i)
		if (widget.cloud.data.inst[index])
			for (let j = 0; j < widget.cloud.data.inst[index].widgets_names.length; ++ j)
				if (node.inputs[i].name === widget.cloud.data.inst[index].widgets_names[j]) {
					node.removeInput(i);
					return;
				}
}

function cloud_remove(node, inst_id, func = cloud_remove_handler) {
	this.select(node, inst_id, false);
	const index = this.cloud.data.inst.findIndex(_ => _.id === inst_id);
	func?.(this, node, inst_id, index);
	this.cloud.data.inst.splice(index, 1);
	delete this.cloud.widgets[inst_id];
	delete this.cloud.data.view[inst_id];
	delete this.cloud.data.pos[inst_id];
	delete this.cloud.data.hit[inst_id];
	for (let group_id in this.cloud.data.group) {
		const idx = this.cloud.data.group[group_id]?.inst?.indexOf?.(inst_id);
		if (idx !== -1)
			this.cloud.data.group[group_id]?.inst?.splice?.(idx, 1);
	}
	cloud_clean_group(this.cloud.data.group);
}

function cloud_build_group(node, mode, second = null, color = undefined) {
	if (second === null) {
		switch (mode) {
			case "_": {
				const curr_id = String(this.cloud.data.id ++);
				this.cloud.data.group[curr_id] = {
					color: color ?? lib0246.rgb_to_hex(
						lib0246.rand_int(108, 230),
						lib0246.rand_int(108, 230),
						lib0246.rand_int(108, 230)
					),
					inst: [...this.cloud.select],
				};
			} break;
			case "global": {
				this.cloud.data.group["global"] = this.cloud.data.group["global"] ?? {};
				this.cloud.data.group["global"].inst = this.cloud.data.group["global"].inst ?? [];
				this.cloud.data.group["global"].inst.push(...this.cloud.select);
				this.cloud.data.group["global"].color = "#000";
				cloud_clean_dupe(this.cloud.data.group);
			} break;
			case `local:${node.id}`: {
				this.cloud.data.group[`local:${node.id}`] = this.cloud.data.group[`local:${node.id}`] ?? {};
				this.cloud.data.group[`local:${node.id}`].inst = this.cloud.data.group[`local:${node.id}`].inst ?? [];
				this.cloud.data.group[`local:${node.id}`].inst.push(...this.cloud.select);
				this.cloud.data.group[`local:${node.id}`].color = "#fff";
				cloud_clean_dupe(this.cloud.data.group);
			} break;
			default: {
				if (this.cloud.data.group[mode]) {
					this.cloud.data.group[mode].inst = this.cloud.data.group[mode].inst ?? [];
					for (let inst_id of this.cloud.select)
						if (this.cloud.data.group[mode].inst.indexOf(inst_id) === -1)
							this.cloud.data.group[mode].inst.push(inst_id);
				}
			} break;
		}
	} else if (this.cloud.data.group[second]) {
		switch (mode) {
			case "_": {
				const curr_id = String(this.cloud.data.id ++);
				this.cloud.data.group[curr_id] = {
					color: color ?? lib0246.rgb_to_hex(
						lib0246.rand_int(108, 230),
						lib0246.rand_int(108, 230),
						lib0246.rand_int(108, 230)
					),
					group: [second],
				};
			} break;
			case "global": {
				this.cloud.data.group["global"] = this.cloud.data.group["global"] ?? {};
				this.cloud.data.group["global"].group = this.cloud.data.group["global"].group ?? [];
				this.cloud.data.group["global"].group.push(second);
				this.cloud.data.group["global"].color = "#000";
				cloud_clean_dupe(this.cloud.data.group);
			} break;
			case `local:${node.id}`: {
				this.cloud.data.group[`local:${node.id}`] = this.cloud.data.group[`local:${node.id}`] ?? {};
				this.cloud.data.group[`local:${node.id}`].group = this.cloud.data.group[`local:${node.id}`].group ?? [];
				this.cloud.data.group[`local:${node.id}`].group.push(second);
				this.cloud.data.group[`local:${node.id}`].color = "#fff";
				cloud_clean_dupe(this.cloud.data.group);
			} break;
			default: {
				if (this.cloud.data.group[mode]) {
					this.cloud.data.group[mode].group = this.cloud.data.group[mode].group ?? [];
					const idx = this.cloud.data.group[mode].group.indexOf(second);
					if (idx !== -1)
						this.cloud.data.group[mode].group.splice(idx, 1);
					this.cloud.data.group[mode].group.push(second);
				}
			} break;
		}
	}
	cloud_clean_group(this.cloud.data.group);
}

function cloud_remove_group(node, group_id, mode) {
	// If second_group_id is "_", delete first_group_id from the entire thing
	switch (mode) {
		case "_": {
			delete this.cloud.data.group[group_id];
		} break;
		case null: {
			const curr_group = this.cloud.data.group[group_id];
			if (curr_group.inst)
				for (let inst_id of this.cloud.select)
					if (curr_group.inst.includes(inst_id))
						curr_group.inst.splice(curr_group.inst.indexOf(inst_id), 1);
		} break;
		default: {
			if (this.cloud.data.group?.[group_id]?.group?.includes?.(mode))
				this.cloud.data.group[group_id].group.splice(this.cloud.data.group[group_id].group.indexOf(mode), 1);
		} break;
	}
	cloud_clean_group(this.cloud.data.group);
}

function cloud_clean_group(group_dict) {
	let valid_group = new Set();

	for (let key in group_dict) {
		let visited = new Set(), stack = [];
		
		if (group_dict[key]?.inst?.length > 0) {
			valid_group.add(key);
			for (let parent in group_dict)
				if (group_dict[parent].group?.includes?.(key))
					stack.push([group_dict[parent], group_dict[key], key]);
		} else {
			delete group_dict[key].inst;
			for (let parent in group_dict)
				if (group_dict[parent].group?.includes?.(key))
					stack.push([group_dict[parent], group_dict[key], key]);
		}

		while (stack.length > 0) {
			const [parent, group, name] = stack.pop();
			if (visited.has(name)) {
				if (parent)
					parent.group.splice(parent.group.indexOf(name), 1);
				continue;
			}
			visited.add(name);
			if (group?.group) {
				if (group.group.length === 0)
					delete group.group;
				else
					for (let child of group.group)
						stack.push([group, group_dict[child], child]);
			}
		}
	}

	for (let key in group_dict) {
		if (group_dict[key].group) {
			for (let i = 0; i < group_dict[key].group.length; ++ i)
				if (!valid_group.has(group_dict[key].group[i]) || !group_dict[group_dict[key].group[i]])
					group_dict[key].group.splice(i --, 1);
			if (group_dict[key].group.length === 0)
				delete group_dict[key];
			else
				valid_group.add(key);
		} else if (!valid_group.has(key))
			delete group_dict[key];
	}

	// for (let group_id in group_dict)
	// 	if (cloud_group_query_inst([], group_dict, group_id).length < 2)
	// 		delete group_dict[group_id];
}

function cloud_clean_dupe(group_dict) {
	for (let group_id in group_dict) {
		if (group_dict[group_id].inst)
			for (let i = 0; i < group_dict[group_id].inst.length; ++ i)
				for (let j = i + 1; j < group_dict[group_id].inst.length; ++ j)
					if (group_dict[group_id].inst[i] === group_dict[group_id].inst[j])
						group_dict[group_id].inst.splice(j --, 1);
		if (group_dict[group_id].group) {
			const idx = group_dict[group_id].group.indexOf(group_id);
			if (idx !== -1)
				group_dict[group_id].group.splice(idx, 1);
			for (let i = 0; i < group_dict[group_id].group.length; ++ i)
				for (let j = i + 1; j < group_dict[group_id].group.length; ++ j)
					if (group_dict[group_id].group[i] === group_dict[group_id].group[j])
						group_dict[group_id].group.splice(j --, 1);
		}
	}
}

function cloud_draw_msg(ctx, widget, inst_id, text, prev_p) {
	const text_measure = ctx.measureText(text),
		idx = widget.cloud.data.pos[inst_id].length - 5,
		// curr_p = prev_p + text_measure.actualBoundingBoxAscent + text_measure.actualBoundingBoxDescent + 2;
		curr_p = prev_p + text_measure.width + 2;
	ctx.strokeStyle = "#000";
	ctx.setLineDash([]);
	ctx.strokeText(
		text,
		widget.flex.hold_draw[0] + widget.cloud.data.pos[inst_id][idx + 1] + prev_p,
		widget.flex.hold_draw[1] +
			widget.cloud.data.pos[inst_id][idx + 2] + widget.cloud.data.pos[inst_id][idx + 4] -
			text_measure.actualBoundingBoxAscent + text_measure.actualBoundingBoxDescent + 6
	);
	ctx.fillText(
		text,
		widget.flex.hold_draw[0] + widget.cloud.data.pos[inst_id][idx + 1] + prev_p,
		widget.flex.hold_draw[1] +
			widget.cloud.data.pos[inst_id][idx + 2] + widget.cloud.data.pos[inst_id][idx + 4] -
			text_measure.actualBoundingBoxAscent + text_measure.actualBoundingBoxDescent + 6
	);
	return curr_p;
	// ctx.strokeText(
	// 	text,
	// 	widget.flex.hold_draw[0] + widget.cloud.data.pos[inst_id][idx + 1],
	// 	widget.flex.hold_draw[1] +
	// 		widget.cloud.data.pos[inst_id][idx + 2] + widget.cloud.data.pos[inst_id][idx + 4] + curr_p
	// );
	// ctx.fillText(
	// 	text,
	// 	widget.flex.hold_draw[0] + widget.cloud.data.pos[inst_id][idx + 1],
	// 	widget.flex.hold_draw[1] +
	// 		widget.cloud.data.pos[inst_id][idx + 2] + widget.cloud.data.pos[inst_id][idx + 4] + curr_p
	// );
	// return curr_p;
}

export function cloud_expand_func(mode, name) {
	if (this.mark && this.res !== true)
		this.res = name.startsWith("cloud:") || name === "_cloud_in";
}

export function CLOUD_WIDGET(data_type, data_name, options = {}) {
	const widget = {
		type: data_type,
		name: data_name,
		get value() {
			for (let i = 0; i < this.cloud.data.inst.length; ++ i)
				if (this.cloud.widgets[this.cloud.data.inst[i].id])
					for (let j = 0; j < this.cloud.widgets[this.cloud.data.inst[i].id].length; ++ j) {
						this.cloud.data.inst[i].widgets_values[j] = [this.cloud.widgets[this.cloud.data.inst[i].id][j].value];
						this.cloud.data.inst[i].widgets_names[j] = this.cloud.widgets[this.cloud.data.inst[i].id][j].name;
					}
			return {
				inst: this.cloud.data.inst,
				group: this.cloud.data.group,
				id: this.cloud.data.id,
			};
		},
		set value(v) {
			// [TODO] Hopefully no one touch these, otherwise we have to manage inputs. Good enough for now
			this.cloud.data.inst = v.inst ?? [];
			this.cloud.data.group = v.group ?? {};
			this.cloud.data.id = v.id ?? 0;
			if (this.cloud.node) {
				const node = app.graph.getNodeById(this.cloud.node);
				for (let inst_id of this.cloud.select)
					this?.select(node, inst_id, false);
				this.cloud.select.clear();
				const stub_obj = {};
				stub_obj.widgets_values = [];
				stub_obj.widgets_values[node.widgets.indexOf(this)] = v;
				node.onConfigure(stub_obj);
			}
		},
		draw: function (ctx, node, widget_width, y, widget_height) {
			// [TODO] Use https://github.com/geongeorge/Canvas-Txt to draw text instead?
			this.cloud.node = node.id;

			ctx.save();

			ctx.beginPath();
			ctx.strokeStyle = "#000000";
			ctx.fillStyle = app.canvas.clear_background_color;
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.rect(this.flex.hold_draw[0], this.flex.hold_draw[1], this.flex.hold_draw[2], this.flex.hold_draw[3]);
			ctx.clip();
			ctx.stroke();
			ctx.fill();
			ctx.closePath();

			if (!Number.isFinite(this.flex.hold_draw[2]) || !Number.isFinite(this.flex.hold_draw[3]))
				return;

			if (!this?.options?.hideOnZoom || app.canvas.ds.scale >= 0.5) {
				ctx.beginPath();
				ctx.font = "9px Consolas";
				ctx.textAlign = "center";
				ctx.textBaseline = "middle";

				for (let i = 0; i < widget.cloud.data.inst.length; ++ i)
					widget.cloud.data.view[widget.cloud.data.inst[i].id] = widget.view(node, widget.cloud.data.inst[i]);

				widget.cloud.data.h = shelf_layout(
					widget.cloud.data.inst, widget.cloud.data.group, widget.cloud.mouse_shift,
					widget.cloud.data.pos, widget.cloud.data.view, widget.cloud.data.hit, widget.cloud.data.row, widget.cloud.data.curr,
					ctx, this.flex.hold_draw[0], this.flex.hold_draw[1], this.flex.hold_draw[2], this.flex.hold_draw[3],
					2, 2, 5, 5,
					4, 4, 4, 4,
					0, 6, 2, 2,
					2, 2
					// 0, 0, 0, 0,
					// 0, 0, 0, 0,
					// 0, 0, 0, 0,
					// 0, 0
				);
				ctx.closePath();

				for (let i = 0, sum_y = 0; i < widget.cloud.data.row.length; ++ i) {
					ctx.beginPath();
					ctx.fillStyle = CLOUD_FILL[i % 2];
					ctx.rect(
						this.flex.hold_draw[0], this.flex.hold_draw[1] + sum_y,
						this.flex.hold_draw[2], widget.cloud.data.row[i]
					);
					ctx.fill();
					ctx.closePath();
					sum_y += widget.cloud.data.row[i] + 2;
				}

				for (let inst_id in widget.cloud.data.pos) {
					ctx.beginPath();
					ctx.fillStyle = "#333";
					if (widget.cloud.select.has(inst_id)) {
						ctx.strokeStyle = "#f00";
						ctx.setLineDash([3, 3]);
					} else {
						ctx.strokeStyle = "#666";
						ctx.setLineDash([]);
					}
					ctx.lineWidth = 1;
					ctx.roundRect(
						this.flex.hold_draw[0] + widget.cloud.data.pos[inst_id][2], this.flex.hold_draw[1] + widget.cloud.data.pos[inst_id][3] + 2,
						widget.cloud.data.pos[inst_id][4], widget.cloud.data.pos[inst_id][5],
						5
					);
					ctx.fill();
					ctx.stroke();
					ctx.closePath();

					ctx.beginPath();
					ctx.font = "9px Consolas";
					ctx.textAlign = "center";
					ctx.textBaseline = "middle";
					switch (widget.cloud.data.inst.find(_ => _.id === inst_id).kind) {
						case "weight": {
							ctx.fillStyle = "#db7756";
						} break;
						case "rand": {
							ctx.fillStyle = "#866cf0";
						} break;
						case "cycle": {
							ctx.fillStyle = "#b05ed6";
						} break;
						case "pin": {
							ctx.fillStyle = "#fcff63";
						} break;
						case "merge": {
							ctx.fillStyle = "#58db5c";
						} break;
						default: {
							ctx.fillStyle = "#ccc";
						}
					}
					ctx.fillText(
						widget.cloud.data.view[inst_id],
						this.flex.hold_draw[0] + widget.cloud.data.pos[inst_id][0],
						this.flex.hold_draw[1] + widget.cloud.data.pos[inst_id][1] + 2
					);
					ctx.closePath();

					let msg_flag = widget.cloud.mouse_move && lib0246.is_inside_rect(
						widget.cloud.mouse_move[0], widget.cloud.mouse_move[1],
						widget.cloud.data.hit[inst_id][0], widget.cloud.data.hit[inst_id][1],
						widget.cloud.data.hit[inst_id][2], widget.cloud.data.hit[inst_id][3]
					), curr_p = 0;
					
					if (msg_flag) {
						ctx.beginPath();
						ctx.fillStyle = "#fff";
						ctx.font = "7px Consolas";
						ctx.textAlign = "left";
						ctx.textBaseline = "middle";
						const curr_inst = widget.cloud.data.inst.find(_ => _.id === inst_id);
						curr_p = cloud_draw_msg(ctx, widget, inst_id, `[${curr_inst.id},${curr_inst.kind}]`, curr_p);
						ctx.closePath();
					}

					const draw_group = new Set();

					for (let ii = 6, jj = 0; ii < widget.cloud.data.pos[inst_id].length; ii += 5, ++ jj) {
						ctx.beginPath();
						ctx.strokeStyle = widget.cloud.data.group[widget.cloud.data.pos[inst_id][ii]].color;
						ctx.setLineDash([4, 6]);
						ctx.lineWidth = 0.75;
						ctx.roundRect(
							this.flex.hold_draw[0] + widget.cloud.data.pos[inst_id][ii + 1], this.flex.hold_draw[1] + widget.cloud.data.pos[inst_id][ii + 2] + 2,
							widget.cloud.data.pos[inst_id][ii + 3], widget.cloud.data.pos[inst_id][ii + 4],
							2
						);
						ctx.stroke();
						ctx.closePath();

						if (msg_flag && !draw_group.has(widget.cloud.data.pos[inst_id][ii])) {
							draw_group.add(widget.cloud.data.pos[inst_id][ii]);
							ctx.beginPath();
							ctx.fillStyle = widget.cloud.data.group[widget.cloud.data.pos[inst_id][ii]].color;
							ctx.font = "7px Consolas";
							ctx.textAlign = "left";
							ctx.textBaseline = "middle";
							let text_msg = "", group_res = [];
							cloud_group_query_group(group_res, widget.cloud.data.group, Object.keys(widget.cloud.data.group), widget.cloud.data.pos[inst_id][ii]);
							if (group_res.length > 0)
								text_msg += `(${group_res[0]}|${group_res.slice(1).join(",")}>${widget.cloud.data.pos[inst_id][ii]})`;
							else
								text_msg += `(${widget.cloud.data.pos[inst_id][ii]})`;
							curr_p = cloud_draw_msg(ctx, widget, inst_id, text_msg, curr_p);
							ctx.closePath();
						}
					}
				}

				if (widget.cloud.data.curr.i !== null && widget.cloud.state.action === "shift") {
					ctx.beginPath();
					ctx.strokeStyle = "#f00";
					ctx.setLineDash([4, 2]);
					ctx.lineWidth = 1;
					ctx.moveTo(
						widget.cloud.data.curr.x,
						widget.cloud.data.curr.y
					);
					ctx.lineTo(
						widget.cloud.data.curr.x,
						widget.cloud.data.curr.y + widget.cloud.data.curr.h
					);
					ctx.stroke();
					ctx.closePath();
				}
			}

			ctx.restore();
		},
		mouse: function (event, pos, node) {
			widget.cloud.state = widget.cloud.state ?? {};
			widget.cloud.delay_state = widget.cloud.delay_state ?? null;
			
			widget.cloud.state.mouse = event.type;
			
			let box_flag = false;
			for (let inst_id in widget.cloud.data.hit)
				if (lib0246.is_inside_rect(
					pos[0], pos[1],
					widget.cloud.data.hit[inst_id][0], widget.cloud.data.hit[inst_id][1],
					widget.cloud.data.hit[inst_id][2], widget.cloud.data.hit[inst_id][3]
				)) {
					widget.cloud.state.where = "box";
					box_flag = true;
					break;
				}

			widget.cloud.state.bound = lib0246.is_inside_rect(
				pos[0], pos[1],
				this.flex.hold_mouse[0], this.flex.hold_mouse[1], this.flex.hold_mouse[2], this.flex.hold_mouse[3]
			) ? "in" : "out";

			if (!widget.cloud.state.where || !box_flag)
				widget.cloud.state.where = "";

			if (!widget.cloud.state.action)
				widget.cloud.state.action = "";

			if (window.performance.now() - (widget.cloud.delay_state ?? 0) > widget.cloud.delay_dbl)
				widget.cloud.delay_state = null;

			eval_state(CLOUD_STATE, widget.cloud.state, node, widget, event, pos);
		},
		build: cloud_build,
		remove: cloud_remove,
		build_group: cloud_build_group,
		remove_group: cloud_remove_group,
		select: cloud_select,
		view: cloud_view
	};

	widget.cloud = widget.cloud ?? {};

	widget.cloud.select = widget.cloud.select ?? new Set();

	widget.cloud.data = widget.cloud.data ?? {
		inst: [],
		view: {},
		group: {},
		row: [],
		pos: {},
		hit: {},
		curr: {},
		id: 0
	};

	widget.cloud.delay_dbl = widget.cloud.delay_dbl ?? options.delay_dbl ?? 200;
	widget.cloud.widgets = widget.cloud.widgets ?? {};

	return widget;
}

export function cloud_menu(name, options) {
	options.push(
		{
			content: `[0246.Cloud "${name}"] 🗑️ Picked Clouds`,
			callback: (value, options, evt, menu, node) => {
				const cloud_widget = node.widgets.find(w => w.name === `cloud:${name}`);
				for (let inst_id of cloud_widget.cloud.select)
					if (cloud_widget.cloud.data.inst.find(_ => _.id === inst_id).kind !== "pin")
						cloud_widget.remove(node, inst_id);
				cloud_widget.cloud.select.clear();
				// node.setSize([node.size[0], Math.max(node.computeSize()[1], node.size[1])]);
				app.canvas.setDirty(true);
			}
		}, {
			content: `[0246.Cloud "${name}"] ✔️ All Clouds`,
			callback: (value, options, evt, menu, node) => {
				const cloud_widget = node.widgets.find(w => w.name === `cloud:${name}`);
				for (let i = 0; i < cloud_widget.cloud.data.inst.length; ++ i)
					if (!cloud_widget.cloud.select.has(cloud_widget.cloud.data.inst[i].id)) {
						cloud_widget.cloud.select.add(cloud_widget.cloud.data.inst[i].id);
						cloud_widget.select(node, cloud_widget.cloud.data.inst[i].id, true);
					}
				// node.setSize([node.size[0], Math.max(node.computeSize()[1], node.size[1])]);
				app.canvas.setDirty(true);
			}
		}, {
			content: `[0246.Cloud "${name}"] 🗑️ Unpick All Clouds`,
			callback: (value, options, evt, menu, node) => {
				const cloud_widget = node.widgets.find(w => w.name === `cloud:${name}`);
				for (let i = 0; i < cloud_widget.cloud.data.inst.length; ++ i)
					if (cloud_widget.cloud.select.has(cloud_widget.cloud.data.inst[i].id)) {
						cloud_widget.select(node, cloud_widget.cloud.data.inst[i].id, false);
						cloud_widget.cloud.select.delete(cloud_widget.cloud.data.inst[i].id);
					}
				// node.setSize([node.size[0], Math.max(node.computeSize()[1], node.size[1])]);
				app.canvas.setDirty(true);
			}
		},
		null, {
			content: `[0246.Cloud "${name}"] ✔️ first_group_id ➡️ Picked Clouds`,
			callback: (value, options, evt, menu, node) => {
				node.widgets.find(w => w.name === `cloud:${name}`).build_group(
					node,
					node.widgets.find(w => w.name === `cloud:${name}:first_group_id`).value,
					null
				);
				app.canvas.setDirty(true);
			}
		}, {
			content: `[0246.Cloud "${name}"] 🗑️ second_group_id ➡️ Picked Clouds`,
			callback: (value, options, evt, menu, node) => {
				node.widgets.find(w => w.name === `cloud:${name}`).remove_group(
					node,
					node.widgets.find(w => w.name === `cloud:${name}:second_group_id`).value,
					null
				);
				app.canvas.setDirty(true);
			}
		}, {
			content: `[0246.Cloud "${name}"] ✔️ first_group_id ➡️ second_group_id`,
			callback: (value, options, evt, menu, node) => {
				node.widgets.find(w => w.name === `cloud:${name}`).build_group(
					node,
					node.widgets.find(w => w.name === `cloud:${name}:first_group_id`).value,
					node.widgets.find(w => w.name === `cloud:${name}:second_group_id`).value
				);
				app.canvas.setDirty(true);
			}
		}, {
			content: `[0246.Cloud "${name}"] 🗑️ first_group_id ➡️ second_group_id`,
			callback: (value, options, evt, menu, node) => {
				node.widgets.find(w => w.name === `cloud:${name}`).remove_group(
					node,
					node.widgets.find(w => w.name === `cloud:${name}:second_group_id`).value,
					node.widgets.find(w => w.name === `cloud:${name}:first_group_id`).value
				);
				app.canvas.setDirty(true);
			}
		},
		null, {
			content: `[0246.Cloud "${name}"] ✔️ Cloud ➡️ 🗑️ Preview`,
			callback: (value, options, evt, menu, node) => {
				
			}
		}, {
			content: `[0246.Cloud "${name}"] ✔️ Preview ➡️ 🗑️ All Clouds`,
			callback: (value, options, evt, menu, node) => {
				// This should allow to specify how to split the preview from a popup using regex
				// By default it will not splite and convert entire thing directly to string
				(async function () {
					const regex = prompt("Please specify delimiter regex", ",\\s"),
						cloud_widget = node.widgets.find(w => w.name === `cloud:${name}`);

					let parse_data = await (await fetch(
						window.location.origin + "/0246-parse-prompt",
						{
							method: "POST",
							headers: {
								"Content-Type": "application/json",
							},
							body: JSON.stringify({
								"regex": regex,
								"prompt": node.widgets.find(w => w.name === `cloud:${name}:preview`).value,
							}),
						}
					)).json();

					cloud_widget.value = {}; // [TODO] There's "pin" cloud, do do not remove those
					let prev_text_cloud = null, prev_weight_cloud = null;

					for (let i = 0; i < parse_data.res.length; ++ i) {
						const text_cloud = cloud_widget.build(node, "text"),
							weight_cloud = cloud_widget.build(node, "weight");
						cloud_widget.cloud.widgets[text_cloud.id][0].options.setValue(parse_data.res[i][0]);
						cloud_widget.cloud.widgets[weight_cloud.id][0].value = parse_data.res[i][1];
						text_cloud.widgets_values[0] = [parse_data.res[i][0]];
						weight_cloud.widgets_values[0] = [parse_data.res[i][1]];
						if (prev_text_cloud)
							cloud_widget.select(node, prev_text_cloud.id, false);
						if (prev_weight_cloud)
							cloud_widget.select(node, prev_weight_cloud.id, false);
						cloud_widget.cloud.select.clear();
						cloud_widget.select(node, text_cloud.id, true);
						cloud_widget.cloud.select.add(text_cloud.id);
						cloud_widget.select(node, weight_cloud.id, true);
						cloud_widget.cloud.select.add(weight_cloud.id);
						cloud_widget.build_group(node, "_", null);
						prev_text_cloud = text_cloud;
						prev_weight_cloud = weight_cloud;
					}
					cloud_widget.select(node, prev_text_cloud.id, false);
					cloud_widget.select(node, prev_weight_cloud.id, false);
					cloud_widget.cloud.select.clear();
					app.canvas.setDirty(true);
				})();
			}
		}, {
			content: `[0246.Cloud "${name}"] ✔️ Preview ➡️ Cloud`,
			callback: (value, options, evt, menu, node) => {
				
			}
		},
		null
	);
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const WIDGETS_MAP = new WeakMap(), WIDGETS_SELF = Symbol("widgets_self");

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
						else if (widget_prop === WIDGETS_SELF)
							return original_widget;
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

export const NODE_PARENT = Symbol("node_parent");

function hijack_widget_name(node, widget) {
	if (node.comfyClass === "0246.Hub" && widget[NODE_PARENT])
		return `node:${widget[NODE_PARENT].id}:${widget.name}`;
	return widget.name;
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export function switch_widget(node, index, value) {
	node.addWidget("combo", `switch:${index}`, value, function (value, canvas, node, pos, evt) {
		const index = node.widgets.findIndex(_ => _ === this);
		node.outputs[index].name = `${node.inputs.find(_ => _.name === value)?.type ?? "_"}:${index}`;
	}, {
		serialize: true,
		values: function (widget) {
			let res = ["_"];
			for (let i = 0; i < node.inputs.length; ++ i)
				if (node.inputs[i].link)
					res.push(node.inputs[i]?.label ?? node.inputs[i].name);
			return res;
		}
	});
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

let ERROR_TRACK = 0;

app.registerExtension({
	name: "0246.Widget",
	async init() {
		// Shamelessly imported :3
		rgthree_utils = await lib0246.try_import("../../../extensions/rgthree-comfy/utils.js");

		// await lib0246.load_script("https://unpkg.com/interactjs@1.10.23/dist/interact.min.js");
		// mtb_widgets =  await lib0246.try_import("../../../extensions/comfy_mtb/mtb_widgets.js");
		// import { JSONEditor } from "https://cdn.jsdelivr.net/npm/vanilla-jsoneditor/standalone.js";
	},
	async setup(app) {
		lib0246.hijack(app.canvas, "processNodeWidgets", function (node) {
			if (!this.mark)
				PROCESS_WIDGET_NODE = node;
			else
				PROCESS_WIDGET_NODE = null;
		});

		lib0246.hijack(app.canvas, "drawNodeWidgets", function () {
			if (!this.mark) {
				const node = arguments[0];
				if (node.comfyClass === "0246.Hub") {
					// [TODO] Temporary. Probably we wants to rebuild widget list dynamically
					// for (let i = 8; i < node.widgets.length; ++ i) {
					// 	let found = false, widget_self = node.widgets[i][WIDGETS_SELF];
					// 	if (!widget_self) continue;
					// 	for (let id in node.hub.node_widget)
					// 		if (
					// 			node.hub.node_widget[id].indexOf(widget_self) > -1 ||
					// 			node.hub.sole_widget.includes(widget_self)
					// 		) {
					// 			found = true;
					// 			break;
					// 		}
					// 	if (!found && widget_self.type !== "space_title")
					// 		node.widgets.splice(i --, 1);
					// }
					// calc_flex(node, node.size[0]);
					// console.log(node.size);
					node.hubSize();
					// app.canvas.setDirty(true);
				}
			}
		});

		lib0246.hijack(app, "graphToPrompt", async function () {
			if (!this.mark)
				for (let i = 0; i < this.self.graph._nodes.length; ++ i) {
					const node = this.self.graph._nodes[i];
					if (node.comfyClass === "0246.Hub")
						setup_hijack_widget(node, hijack_widget_name);
				}
			else
				for (let i = 0; i < this.self.graph._nodes.length; ++ i) {
					const node = this.self.graph._nodes[i];
					if (node.comfyClass === "0246.Hub")
						reset_hijack_widget(node);
				}
		});

		lib0246.hijack(app.graph, "remove", function (node) {
			if (!this.mark && node.type === "0246.Junction") {
				for (let i = node.inputs.length - 1; i >= 0; -- i)
					node.removeInput(i);
				for (let i = node.outputs.length - 1; i >= 0; -- i)
					node.removeOutput(i);
			}
		});

		app.ui.settings.addSetting({
			id: "0246.AlternateDOMWidget",
			name: "[ComfyUI-0246] Alternative DOM widget implementation",
			tooltip: lib0246.indent_str `
				Enable alternative DOM widget implementation by replacing the default DOM widget implementation.

				Disable if you're experiencing issues relating to text boxes floating/lingering and other rendering stuff.

				This setting are required to use "[0246.Cloud]" node.
			`,
			type: "boolean",
			defaultValue: true,
		});
	},
	async getCustomWidgets(app) {
		return {
			BOX_RANGE: function(node, inputName, inputData, app) {
				const ratio_widget = node.addCustomWidget(RATIO_WIDGET("RATIO_RANGE", inputName + "_ratio"));
				inputData[1].ratio = inputData?.[1]?.ratio ?? {};
				inputData[1].ratio.lock = inputData?.[1]?.ratio.lock ?? {};
				inputData[1].ratio.lock.ratio = inputData?.[1]?.ratio.lock.ratio ?? false;
				inputData[1].ratio.lock.width = inputData?.[1]?.ratio.lock.width ?? false;
				inputData[1].ratio.lock.height = inputData?.[1]?.ratio.lock.height ?? false;
				inputData[1].ratio.data = inputData?.[1]?.ratio.data ?? {};
				inputData[1].ratio.data.width = inputData?.[1]?.ratio.data.width ?? 512;
				inputData[1].ratio.data.height = inputData?.[1]?.ratio.data.height ?? 512;
				inputData[1].ratio.data.ratio = inputData?.[1]?.ratio.data.width === 0 || inputData?.[1]?.ratio.data.height === 0 ? 0 :
					(inputData?.[1]?.ratio?.data?.ratio ?? (inputData[1].ratio.data.width / inputData[1].ratio.data.height));

				inputData[1].row_count = inputData?.[1]?.row_count ?? 10;
				inputData[1].col_count = inputData?.[1]?.col_count ?? 10;
				const box_widget = node.addCustomWidget(BOX_RANGE_WIDGET("BOX_RANGE", inputName, inputData[1]));
				inputData[1].flex = inputData?.[1]?.flex ?? {};
				inputData[1].flex.ratio = inputData?.[1]?.ratio.data.ratio;
				inputData[1].flex.share = inputData?.[1]?.flex.share ?? 1;
				inputData[1].flex.min_h = inputData?.[1]?.flex.min_h ?? 50;
				inputData[1].flex.center = inputData?.[1]?.flex.center ?? true;
				widget_flex(node, box_widget, inputData[1].flex);
				box_widget.linkedWidgets = [ratio_widget];
				box_widget.options.hideOnZoom = inputData?.[1]?.hideOnZoom ?? true;
				return {
					widget: box_widget,
				}
			},
			CLOUD_DATA: function(node, inputName, inputData, app) {
				if (!app.ui.settings.getSettingValue("0246.AlternateDOMWidget", false)) {
					if (ERROR_TRACK ++ < 1)
						lib0246.error_popup("0246.AlternateDOMWidget is disabled, please enable it to use Cloud node");
					throw new Error("0246.AlternateDOMWidget is disabled, please enable it to use Cloud node");
				}

				let cloud_widget;

				const insert_widget = node.addWidget(
					"combo", `cloud:${inputName}:kind`, "Select Kind",
					function (value, canvas, node, pos, evt) {
						if (value !== "_")
							cloud_widget.build(node, value);
						cloud_widget.linkedWidgets[0].value = "Select Kind";
					}, {
						serialize: false,
						values: [
							"text", "weight", "rand", "cycle", "merge"
							// [TODO] Support "text_list", "text_json", "mark", "lora" and "embedding"
							// "lora" and "embedding" are self explanatory
							// "mark" is basically make a Script to do text-based stuff like cutoff and gligen
						]
					}
				);

				const first_group_widget = node.addWidget("combo", `cloud:${inputName}:first_group_id`, "_", () => {}, {
					serialize: false,
					values: function (widget) {
						// let res = ["_", "global", `local:${node.id}`];
						// for (let key in cloud_widget.cloud.data.group) {
						// 	if (key === "global" || key === `local:${node.id}`)
						// 		continue;
						// 	else
						// 		res.push(key);
						// }
						// return res;
						return ["_", ...Object.keys(cloud_widget.cloud.data.group ?? {})];
					}
				});
				const second_group_widget = node.addWidget("combo", `cloud:${inputName}:second_group_id`, "", () => {}, {
					serialize: false,
					values: function (widget) {
						// return ["_", ...Object.keys(cloud_widget.cloud.data.group ?? {})];
						return Object.keys(cloud_widget.cloud.data.group ?? {});
					}
				});

				// wg0246.setup_log(node, true, true);

				const preview_widget = ComfyWidgets["STRING"](node, `cloud:${inputName}:preview`, ["STRING", {
					multiline: true,
				}], app).widget;
				preview_widget.flex.share = 1.5;

				cloud_widget = node.addCustomWidget(CLOUD_WIDGET("CLOUD_DATA", `cloud:${inputName}`));
				widget_flex(node, cloud_widget, {
					ratio: 0,
					share: 3.5,
					min_h: 100,
					center: true,
					margin_x: 10,
				});
				if (inputData?.[1]?.cloud)
					cloud_widget.value = inputData[1].cloud;
				cloud_widget.options.hideOnZoom = inputData?.[1]?.hideOnZoom ?? true;
				
				if (!node.constructor.nodeData[CLOUD_MARK]) {
					node.constructor.nodeData[CLOUD_MARK] = {};
					node.constructor.nodeData.input = node.constructor.nodeData.input ?? {};
					node.constructor.nodeData.input.required = new Proxy({}, {
						get: function (target, prop, receiver) {
							const widget = node.constructor.nodeData[CLOUD_MARK].self.widgets.find(w => w.name === prop);
							return [(widget.type === "customtext" || widget.type === "string") ? "STRING" : widget.type, widget.options];
						}
					});
				}

				if (!node[CLOUD_MARK]) {
					node[CLOUD_MARK] = true;

					lib0246.hijack(node, "onConfigure", function (data) {
						const node = this.self;
						if (this.mark)
							for (let i = 0; i < node.widgets.length; ++ i)
								if (node.widgets[i].type === "CLOUD_DATA")
									for (let inst_id in data.widgets_values[i].inst) {
										const curr_inst = data.widgets_values[i].inst[inst_id];
										node.widgets[i].build(
											node, curr_inst.kind,
											curr_inst,
											data.inputs.filter(_ => curr_inst.widgets_names.includes(_.name)),
											data
										);
									}
					});

					lib0246.hijack(node, "clone", function () {
						const node = this.res;
						if (this.mark)
							for (let j = 0; j < node.widgets.length; ++ j)
								if (node.widgets[j].type === "CLOUD_DATA")
									for (let i = 0; i < node.widgets[j].cloud.data.inst.length; ++ i)
										if (node.widgets[j].cloud.data.inst[i].kind === "pin") {
											node.widgets[j].remove(this.res, node.widgets[j].cloud.data.inst[i].id);
											-- i;
										}
					});

					lib0246.hijack(node, "onConnectInput", function (
						this_slot_index,
						other_slot_type,
						other_slot_obj,
						other_node,
						other_slot_index
					) {
						if (this.mark && this.self.inputs[this_slot_index].name === "...")
							for (let i = 0; i < this.self.widgets.length; ++ i)
								if (this.self.widgets[i].type === "CLOUD_DATA")
									this.self.widgets[i].build(this.self, "pin");
					});

					lib0246.hijack(node, "onConnectionsChange", function (
						type, index, connected, link_info
					) {
						if (this.mark)
							if (!connected && type === LiteGraph.INPUT) {
								const curr_pin_index = Number(this.self.inputs[index].name.split(":")?.[0]);
								if (!Number.isNaN(curr_pin_index))
									for (let i = 0; i < this.self.widgets.length; ++ i)
										if (this.self.widgets[i].type === "CLOUD_DATA"){
											const cloud_widget = this.self.widgets[i],
													curr_inst = cloud_widget.cloud.data.inst.findLast(
														_ => _.kind === "pin" && _.widgets_values[0] === curr_pin_index
													);
											cloud_widget.remove(this.self, curr_inst.id);
											cloud_widget.cloud.select.delete(curr_inst.id);
											for (let i = 0; i < cloud_widget.cloud.data.inst.length; ++ i)
												if (
													cloud_widget.cloud.data.inst[i].kind === "pin" &&
													cloud_widget.cloud.data.inst[i].widgets_values[0] > curr_pin_index
												)
													-- cloud_widget.cloud.data.inst[i].widgets_values[0];
										}
							}
					});
				}

				cloud_widget.linkedWidgets = [insert_widget, first_group_widget, second_group_widget, preview_widget];
				return {
					widget: cloud_widget,
				};
			}
		}
	},
});

// [TODO] Copy-paste specific cloud through implement right-click menu
// [TODO] CLoud scrolling

// LiteGraph.LGraphCanvas.link_type_colors

// window.test = [
// 	0, 0, 0, 0, 0, 0, 0, 0, 0, 0
// ];