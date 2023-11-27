import { app } from "../../../scripts/app.js";

function error_popup(msg) {
	let dialog = new ComfyDialog();
	dialog.show(`<p>${msg}</p>`);
}

function hijack(obj, key, before_func, after_func) {
	const old_func = obj[key] ?? (() => {});
	obj[key] = function () {
		before_func.apply(this, arguments);
		old_func.apply(this, arguments);
		after_func.apply(this, arguments);
	};
}

function monitorArray(obj, key) {
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
						debugger;
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
				debugger;
			}
			originalArray = newArray.slice();
			loggingArray = createLoggingArray(originalArray);
		},
		enumerable: true,
		configurable: true
	});
	
	obj.___MARK___ = true;

	let flag = false;
	hijack(window, "structuredClone", (obj) => {
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
					error_popup(`Error when processing root: ${node.getTitle()}`);
				} break;
				case 1: {
					error_popup(`Error when processing leaf: ${node.getTitle()}`);
				} break;
				case 2: {
					error_popup(`Error when processing branch: ${node.getTitle()}`);
				} break;
			}
		}
	);
}

// Extremely hacky ways to fix issues with Reroute (rgthree). Maybe open issue about this?
app.registerExtension({
	name: "0246.Fixes",
	async setup(app) {
		if (LiteGraph.Nodes.RerouteNode) {
			// Hijack Reroute (rgthree) to do onConnectOutput and onConnectInput
			const reroute = LiteGraph.Nodes.RerouteNode.prototype;

			hijack(reroute, "onConnectionsChange", () => {}, function (type, index, connected, link_info) {
				reroute_process(this);
			});

			// Since native "Reroute" already did graph traversal, we don't need to hijack it
		}
	}
});

// Junk: https://pastebin.com/raw/ibGnvzed