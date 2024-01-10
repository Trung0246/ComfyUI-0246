import { app } from "../../../scripts/app.js";
import * as lib0246 from "./utils.js";

export function monitor_value(obj, key) {
	let originalValue = obj[key];

	Object.defineProperty(obj, key, {
		get: function () {
			return originalValue;
		},
		set: function (newValue) {
			console.log(`${key} changed from ${originalValue} to ${newValue}`);
			if (window.debug_flag) {
				console.trace();
				// debugger;
			}
			originalValue = newValue;
		},
		enumerable: true,
		configurable: true
	});
}

export function monitor_array(obj, key) {
	let originalArray = obj[key];

	function createLoggingArray(array) {
		let loggingArray = [];
		array.forEach((value, index) => {
			Object.defineProperty(loggingArray, index, {
				get: function () {
					return value;
				},
				set: function (newValue) {
					console.log(`${key}[${index}] changed from ${value} to ${newValue}`);
					if (window.debug_flag) {
						console.trace();
						// debugger;
					}
					value = newValue;
				},
				enumerable: true,
				configurable: true
			});
		});
		return loggingArray;
	}

	let loggingArray = createLoggingArray(originalArray);

	Object.defineProperty(obj, key, {
		get: function () {
			return loggingArray;
		},
		set: function (newArray) {
			console.log(`${key} changed from [${originalArray}] to [${newArray}]`);
			if (window.debug_flag) {
				console.trace();
				// debugger;
			}
			originalArray = newArray.slice();
			loggingArray = createLoggingArray(originalArray);
		},
		enumerable: true,
		configurable: true
	});
	
	obj.___MARK___ = true;

	let flag = false;
	lib0246.hijack(window, "structuredClone", (obj) => {
		if (!this.mark) {
			if (obj && obj.___MARK___)
				flag = true;
		} else if (flag) {
			monitorArray(obj, key);
			obj.___MARK___ = true;
			flag = false;
		}
	});
}

/////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////

function tree_traversal(startNode, inputAccessCallback, outputAccessCallback, isBranchCallback, rootCallback, leafCallback, branchCallback, errorCallback) {
	// Helper function to find the root by tracing inputs
	function findRoot(node, inputAccessCallback, visited) {
		let currentNode = node;
		while (true) {
			if (visited.has(currentNode)) {
				// A cycle is detected, so there's no root
				errorCallback(currentNode);
				return null;
			}
			visited.add(currentNode);

			const parentNode = inputAccessCallback(currentNode);
			
			if (parentNode === null)
				return currentNode;

			currentNode = parentNode;
		}
	}

	// First pass to collect all nodes starting from root
	function collectFromRoot(rootNode, outputAccessCallback, visited) {
		const stack = [rootNode];
		const collectedNodes = new Set();
		while (stack.length > 0) {
			const node = stack.pop();
			if (!collectedNodes.has(node)) {
				collectedNodes.add(node);
				visited.add(node); // Mark this node as visited
				// Add child nodes to the stack
				stack.push(...outputAccessCallback(node));
			}
		}
		return collectedNodes;
	}

	// Second pass to apply callbacks in the required order
	function applyCallbacks(nodes, isBranchCallback, rootCallback, leafCallback, branchCallback, inputAccessCallback, outputAccessCallback) {
		let root = null;
		const leaves = [];
		const branches = [];
		nodes.forEach(node => {
			if (inputAccessCallback(node) === null)
				root = node;
			else if (!isBranchCallback(node))
				leaves.push(node);
			else
				branches.push(node);
		});

		// Handle edge cases
		if (root === null || leaves.length === 0) {
			errorCallback?.(null);
			return;
		}
		if (nodes.size === 1) { // Single node graph edge case
			errorCallback?.(root);
			return;
		}

		// Apply callbacks and call error callback if any returns false
		if (rootCallback(root) === false) {
			errorCallback?.(root, 0);
			return;
		}
		for (let i = 0; i < leaves.length; ++ i)
			if (leafCallback(leaves[i]) === false) {
				errorCallback?.(leaves[i], 1);
				return;
			}
		for (let i = 0; i < branches.length; ++ i)
			if (branchCallback(branches[i]) === false) {
				errorCallback?.(branches[i], 2);
				return;
			}
	}

	// Set to keep track of visited nodes to detect cycles
	const visited = new Set();

	// Start by finding the root
	const root = findRoot(startNode, inputAccessCallback, visited);

	// If a cycle was detected and no root was found, return early
	if (root === null)
		return;

	// Collect all nodes starting from the root using iterative DFS
	const allNodes = collectFromRoot(root, outputAccessCallback, visited);

	// Apply the callbacks in the required order
	applyCallbacks(allNodes, isBranchCallback, rootCallback, leafCallback, branchCallback, inputAccessCallback, outputAccessCallback);
}

function is_reroute(node) {
	// return node.prototype === LiteGraph.Nodes.RerouteNode.prototype.prototype;
	return node.type === "Reroute (rgthree)" || node.type === "Reroute";
}

function reroute_process(self) {
	let main_type = "",
		root = null;
	tree_traversal(
		self,
		(node) => {
			if (!is_reroute(node))
				return null;
			if (!node.inputs)
				return null;
			if (node.inputs[0].link === null)
				return null;
			return app.graph.getNodeById(app.graph.links[node.inputs[0].link].origin_id);
		},
		(node) => {
			const nodes = [];
			if (node.outputs)
				for (let i = 0; i < node.outputs.length; ++ i)
					if (node.outputs[i].links !== null)
						for (let j = 0; j < node.outputs[i].links.length; ++ j)
							nodes.push(app.graph.getNodeById(app.graph.links[node.outputs[i].links[j]].target_id));
			return nodes;
		},
		(node) => {
			let flag = is_reroute(node);
			if (flag)
				node.__branch = true;
			return flag;
		},
		(node) => {
			let pin = null
			scope: {
				for (let i = 0; i < node.outputs.length; ++ i) {
					if (node.outputs && node.outputs[i].links)
						for (let j = 0; j < node.outputs[i].links.length; ++ j) {
							let curr = app.graph.getNodeById(app.graph.links[node.outputs[i].links[j]].target_id);
							if (curr.__branch) {
								pin = node.outputs[i];
								if (pin.type === "*")
									return;
								main_type = pin.type;
								root = node;
								break scope;
							}
						}
				}
				return;
			}

			// Check if any others connection to this pin have different types then disconnect them
			for (let i = 0; i < pin.links.length; ++ i) {
				let curr = app.graph.getNodeById(app.graph.links[pin.links[i]].target_id);
				if (curr.__branch)
					continue;
				if (curr.outputs[app.graph.links[pin.links[i]].target_slot].type !== main_type)
					node.disconnectOutput(pin.links[i], curr);
			}
		},
		(node) => {
			// Loop through all input pins and see which node have __branch
			for (let i = 0; i < node.inputs.length; ++ i) {
				if (node.inputs[i].link === null)
					continue;
				let curr = app.graph.getNodeById(app.graph.links[node.inputs[i].link].origin_id);
				if (curr.__branch) {
					const pin = node.inputs[i];
					if (pin.type === "*") {
						if (main_type !== "") {
							pin.type = main_type;
							break;
						}
						return false;
					}
					if (pin.type !== main_type) {
						// Disconnect
						node.disconnectInput(i);
						return;
					}
					main_type = pin.type;
					break;
				}
			}
		},
		(node) => {
			delete node.__branch;

			// Set all input pins and output pins to main_type
			node.inputs[0].type = main_type;
			node.outputs[0].type = main_type;
		},
		(node, code) => {
			if (node === null || node)
				return;

			switch (code) {
				case 0: {
					lib0246.error_popup(`Error when processing root: ${node.getTitle()}`);
				} break;
				case 1: {
					lib0246.error_popup(`Error when processing leaf: ${node.getTitle()}`);
				} break;
				case 2: {
					lib0246.error_popup(`Error when processing branch: ${node.getTitle()}`);
				} break;
			}
		}
	);
}

/////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////

// Probably safe enough unless someone else attempting to reuse these. Ouch.
const patch_node_db = [
	["Highway", "0246.Highway"],
	["Junction", "0246.Junction"],
	["JunctionBatch", "0246.JunctionBatch"],
	["Loop", "0246.Loop"],
	["Count", "0246.Count"],
	["Hold", "0246.Hold"],
	["Beautify", "0246.Beautify"],
	["Random", "0246.RandomInt"],
	["Stringify", "0246.Stringify"],
];

const patch_node_db_0_0_3 = [
	["0246.ScriptPlan", "0246.ScriptRule"],
	["0246.ScriptImbue", "0246.ScriptNode"],
];

let PATCH_SIG = [];

function patch_script(workflow) {
	for (let i = 0; i < workflow.nodes.length; ++ i) {
		for (let j = 0; j < patch_node_db_0_0_3.length; ++ j) {
			if (workflow.nodes[i].type === patch_node_db_0_0_3[j][0]) {
				console.warn(`[ComfyUI-0246] Patching node "${workflow.nodes[i].type}" to "${patch_node_db_0_0_3[j][1]}"`);
				workflow.nodes[i].type = patch_node_db_0_0_3[j][1];
				if (workflow.nodes[i].type === "0246.ScriptRule") {
					workflow.nodes[i].outputs.shift();
					workflow.nodes[i].widgets_values[0] = workflow.nodes[i].widgets_values[3];
				} else if (workflow.nodes[i].type === "0246.ScriptNode")
					workflow.nodes[i].outputs[2].name = "script_exec_data";
				if (!PATCH_SIG.includes(2))
					PATCH_SIG.push(2);
				break;
			} else if (workflow.nodes[i].type === patch_node_db_0_0_3[j][1])
				break;
		}
	}
}

lib0246.hijack(app, "loadGraphData", function (workflow) {
	if (!this.mark) {
		PATCH_SIG.length = 0;
		if (workflow) {
			if (!workflow?.extra?.["0246.VERSION"]) {
				for (let i = 0; i < workflow.nodes.length; ++ i) {
					for (let j = 0; j < patch_node_db.length; ++ j) {
						if (workflow.nodes[i].type === patch_node_db[j][0]) {
							console.warn(`[ComfyUI-0246] Patching node "${workflow.nodes[i].type}" to "${patch_node_db[j][1]}"`);
							workflow.nodes[i].type = patch_node_db[j][1];
							break;
						} else if (workflow.nodes[i].type === patch_node_db[j][1])
							break;
					}
					if ((workflow.nodes[i].type === "0246.Highway" || workflow.nodes[i].type === "0246.HighwayBatch") && !PATCH_SIG.includes(1))
						PATCH_SIG.push(1);
					else if (workflow.nodes[i].type === "0246.Hub") {
						console.warn(`[ComfyUI-0246] Patching node "${workflow.nodes[i].id}" with value __BATCH__ to __BATCH_PRIM__`);
						if (workflow.nodes[i].widgets_values?.[0] === "__BATCH__")
							workflow.nodes[i].widgets_values[0] = "__BATCH_PRIM__";
						const curr_type_list = workflow.extra["0246.HUB_DATA"][workflow.nodes[i].id].sole_type;
						if (workflow.nodes[i].outputs)
							for (let j = 0; j < workflow.nodes[i].outputs.length; ++ j) {
								const curr_name = workflow.nodes[i].outputs[j].name;
								if (curr_name?.endsWith?.("__BATCH__")) {
									const curr_type = curr_type_list[curr_name];
									curr_type[curr_type.length - 1] = "__BATCH_PRIM__";
									const new_name = curr_type.join(":");
									curr_type_list[new_name] = curr_type;
									delete curr_type_list[curr_name];
									workflow.nodes[i].outputs[j].name = new_name;
								}
							}
					}
				}
				patch_script(workflow);
			}
			else if (
				workflow.extra["0246.VERSION"][0] === 0 &&
				workflow.extra["0246.VERSION"][1] === 0 &&
				workflow.extra["0246.VERSION"][2] === 3
			)
				patch_script(workflow);

			for (let i = 0; i < workflow.nodes.length; ++ i)
				if (workflow.nodes[i].type === "0246.BoxRange") {
					if (workflow.nodes[i].widgets_values[0] === "ConditioningSetAreaPercentage")
						workflow.nodes[i].widgets_values[0] = "%(x, y, width, height)";
				} else if (workflow.nodes[i].type === "0246.ScriptNode") {
					if (
						workflow.nodes[i].widgets_values[2] === "pin_highway_deep" ||
						workflow.nodes[i].widgets_values[2] === "pin_highway_flat"
					)
						workflow.nodes[i].widgets_values[2] = "pin_highway";
				}
		}
	} else {
		if (PATCH_SIG.includes(1))
			for (let i = 0; i < app.graph._nodes.length; ++ i)
				if (app.graph._nodes[i].type === "0246.Highway" || app.graph._nodes[i].type === "0246.HighwayBatch") {
					for (let j = 0; j < app.graph._nodes[i].widgets.length; ++ j)
						if (app.graph._nodes[i].widgets[j].name === "Update") {
							app.graph._nodes[i].widgets[j].callback();
							break;
						}
				}
		window.setTimeout(() => {
			if (PATCH_SIG.includes(2)) {
				for (let i = 0; i < app.graph._nodes.length; ++ i) {
					// if (app.graph._nodes[i].type === "0246.ScriptNode")
					// 	for (let j = 0; j < app.graph._nodes[i].outputs.length; ++ j)
					// 		app.graph._nodes[i].disconnectOutput(j);
					for (let j = 0; j < patch_node_db_0_0_3.length; ++ j)
						if (app.graph._nodes[i].type === patch_node_db_0_0_3[j][1])
							app.graph._nodes[i].setSize([app.graph._nodes[i].size[0], app.graph._nodes[i].computeSize()[1]]);
				}
				lib0246.error_popup(lib0246.indent_str `
					Recent update have 0246.ScriptNode (formerly 0246.ScriptImbue) have it output changed due to bad design.
					Please reconnect all output to desired node manually.

					Also remember to check for all 0246.ScriptRule if they have intended data.
				`);
			}
		}, 0);
	}
});

/////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////

let error_flag = false;
lib0246.hijack(app, "showMissingNodesError", function (nodes) {
	if (!this.mark) {
		if (!error_flag)
			for (let i = 0; i < nodes.length; ++ i)
				for (let j = 0; j < patch_node_db.length; ++ j)
					if (nodes[i] === patch_node_db[j][0]) {
						lib0246.error_popup(lib0246.indent_str `
							[ComfyUI-0246] Unfortunately I have to change node internal ID due to I'm being dumb for using generic name. Sorry for inconvenience.

							If this error message shown then that mean automatic patching failed. Please replace each nodes manually :(

							Affected node:

							- Highway -> 0246.Highway
							- Junction -> 0246.Junction
							- JunctionBatch -> 0246.JunctionBatch
							- Loop -> 0246.Loop
							- Count -> 0246.Count
							- Hold -> 0246.Hold
							- Beautify -> 0246.Beautify
							- Random -> 0246.RandomInt
							- Stringify -> 0246.Stringify

							- 0246.ScriptPlan -> 0246.ScriptRule
							- 0246.ScriptImbue -> 0246.ScriptNode
						`);
						error_flag = true;
						break;
					}
	}
});

// Extremely hacky ways to fix issues with Reroute (rgthree). Maybe open issue about this?
app.registerExtension({
	name: "0246.Fixes",
	async setup(app) {
		if (LiteGraph.Nodes.RerouteNode) {
			// Hijack Reroute (rgthree) to do onConnectOutput and onConnectInput
			lib0246.hijack(LiteGraph.Nodes.RerouteNode.prototype, "onConnectionsChange", function (type, index, connected, link_info) {
				if (!this.mark)
					reroute_process(this.self);
			});

			// Since native "Reroute" already did graph traversal, we don't need to hijack it
		}

		lib0246.hijack(app.graph, "serialize", function () {
			// Only used when breaking changes happen
			if (!this.mark)
				app.graph.extra["0246.VERSION"] = [0, 0, 4];
		});
	}
});

// ctx.beginPath();
// ctx.fillStyle = "#ff00ff";
// ctx.arc(
// 	this.self.flex.hold_draw[0],
// 	this.self.flex.hold_draw[1],
// 	4, 0, Math.PI * 2
// );
// ctx.fill();
// ctx.closePath();

// ctx.beginPath();
// ctx.fillStyle = "#ff00ff";
// ctx.arc(
// 	this.self.flex.hold_draw[0] + this.self.flex.hold_draw[2],
// 	this.self.flex.hold_draw[1] + this.self.flex.hold_draw[3],
// 	4, 0, Math.PI * 2
// );
// ctx.fill();
// ctx.closePath();

// function draw_chain(
// 	ctx,
// 	fill_c, stroke_c, line_w,
// 	link_w, link_h, spacing,
// 	box_x, box_y, box_w, box_h
// ) {
// 	// Calculate how many links can fit in the box
// 	let links = Math.floor(box_w / (link_w + spacing));

// 	// Draw chain links
// 	for (let i = 0; i < links; ++ i) {
// 		let center_x = box_x + i * (link_w + spacing) + link_w / 2,
// 			center_y = box_y + box_h / 2;
// 		ctx.beginPath();
// 		ctx.fillStyle = fill_c;
// 		ctx.strokeStyle = stroke_c;
// 		ctx.lineWidth = line_w;
// 		ctx.ellipse(center_x, center_y, link_w / 2, link_h / 2, 0, 0, 2 * Math.PI);
// 		ctx.stroke();
// 		ctx.closePath();
// 	}
// }

// for (let inst_id in widget.cloud.data.hit) {
// 	ctx.beginPath();
// 	ctx.strokeStyle = "#f0f";
// 	ctx.lineWidth = 1;
// 	ctx.setLineDash([]);
// 	ctx.rect(
// 		widget.cloud.data.hit[inst_id][0], widget.cloud.data.hit[inst_id][1],
// 		widget.cloud.data.hit[inst_id][2], widget.cloud.data.hit[inst_id][3]
// 	);
// 	ctx.stroke();
// 	ctx.closePath();
// }

// {
// 	function Test() {}

// 	Test.title = "Test";
// 	Test.category = "0246";
// 	Test.comfyClass = "0246.Test";
// 	Test.collapsable = true;
// 	Test.title_mode = LiteGraph.NORMAL_TITLE;

// 	Test.prototype.onNodeCreated = function() {
// 		const node = this;
// 		const box_widget = node.addCustomWidget(BOX_RANGE_WIDGET("BOX_RANGE", "box_range", {
// 			row_count: 10,
// 			col_count: 10,
// 		}));
		
// 		widget_flex(node, box_widget, {
// 			ratio: 0,
// 			share: 1,
// 			min_h: 50,
// 			center: true,
// 		});
// 	}

// 	LiteGraph.registerNodeType("0246.Test", Test);
// }

// inst: [
// 	{
// 		id: "1",
// 		kind: "text",
// 		widgets_values: ["zxc xcv cvb"]
// 	}, {
// 		id: "2",
// 		kind: "text_json",
// 		widgets_values: ["./test.json", ".[][1]"]
// 	}, {
// 		id: "0",
// 		kind: "text",
// 		widgets_values: ["asd sdf dfg"]
// 	}, {
// 		id: "3",
// 		kind: "text_list",
// 		widgets_values: ["asd\nsdf\ndfg"]
// 	},

// 	{
// 		id: "4",
// 		kind: "weight",
// 		widgets_values: [1]
// 	}, {
// 		id: "5",
// 		kind: "rand",
// 		widgets_values: [1, 0, "randomize"]
// 	}, {
// 		id: "6",
// 		kind: "cycle",
// 		widgets_values: [0, 0]
// 	}, {
// 		id: "9",
// 		kind: "mark",
// 		widgets_values: ["gligen", 0]
// 	}, {
// 		id: "7",
// 		kind: "flip",
// 		widgets_values: [false]
// 	}, {
// 		id: "8",
// 		kind: "mark",
// 		widgets_values: ["cutoff", 0]
// 	}, {
// 		id: "10",
// 		kind: "pin",
// 		widgets_values: [0]
// 	},
// ],
// view: {
// 	["0"]: "asd sdf dfg",
// 	["1"]: "zxc xcv cvb",
// 	["2"]: "testing",
// 	["3"]: "asd\nsdf\ndfg",
// 	["4"]: "1.00",
// 	["5"]: "@RAND",
// 	["6"]: "@CYCLE",
// 	["7"]: "@FLIP",
// 	["8"]: "#CUTOFF",
// 	["9"]: "#GLIGEN",
// 	["10"]: "$0000000000000000000000000000000000",
// },
// group: {
// 	["11"]: {
// 		inst: ["1", "4", "6", "8"],
// 		color: "#ff0"
// 	},
// 	["22"]: {
// 		inst: ["2", "5", "7", "9"],
// 		color: "#0ff"
// 	},
// 	["33"]: {
// 		group: ["11"],
// 		color: "#f0f"
// 	},
// 	// ["44"]: {
// 	// 	group: ["33"]
// 	// },
// 	// ["11"]: {
// 	// 	inst: ["2"]
// 	// },
// 	// ["22"]: {
// 	// 	inst: ["2"]
// 	// },
// },

// if (node.configure && !node.configure[lib0246.HIJACK_MARK]) {
// 	let temp_compute_size;
// 	lib0246.hijack(node, "configure", function (data) {
// 		if (!this.mark) {
// 			temp_compute_size = node.computeSize;
// 			node.computeSize = function () {
// 				return [data.size[0], data.size[1]];
// 			};
// 		} else
// 			window.setTimeout(() => {
// 				node.size = node.computeSize();
// 				node.computeSize = temp_compute_size;
// 			}, 0);
// 	});
// }

// if (nodeData.category === "group nodes/workflow")
// 	GROUP_NODE_CATEGORY_LIST.push(nodeData.comfyClass);