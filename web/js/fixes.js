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
		if (obj && obj.___MARK___)
			flag = true;
	}, function (obj) {
		if (flag) {
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
			}
	}
}, function (workflow) {
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
});

/////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////

let error_flag = false;
lib0246.hijack(app, "showMissingNodesError", function (nodes) {
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
}, () => {});

// Extremely hacky ways to fix issues with Reroute (rgthree). Maybe open issue about this?
app.registerExtension({
	name: "0246.Fixes",
	async setup(app) {
		if (LiteGraph.Nodes.RerouteNode) {
			// Hijack Reroute (rgthree) to do onConnectOutput and onConnectInput
			lib0246.hijack(LiteGraph.Nodes.RerouteNode.prototype, "onConnectionsChange", () => {}, function (type, index, connected, link_info) {
				reroute_process(this.self);
			});

			// Since native "Reroute" already did graph traversal, we don't need to hijack it
		}

		lib0246.hijack(app.graph, "serialize", function () {
			// Only used when breaking changes happen
			app.graph.extra["0246.VERSION"] = [0, 0, 4];
		}, () => {});
	}
});