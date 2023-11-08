import { app } from "../../../scripts/app.js";
import { ComfyDialog } from "../../../scripts/ui.js";

function error_popup(msg) {
	let dialog = new ComfyDialog();
	dialog.show(`<p>${msg}</p>`);
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

function serialize_type(node) {
	let data = {
		in: [],
		out: []
	}
	for (let i = 0; i < node.inputs.length; ++ i) {
		if (node.inputs[i].name[0] === "_")
			continue;
		data.in.push({
			name: node.inputs[i].orig_name,
			full_name: node.inputs[i].name,
			type: node.inputs[i].type,
		});
	}
	for (let i = 0; i < node.outputs.length; ++ i) {
		if (node.outputs[i].name[0] === "_")
			continue;
		data.out.push({
			name: node.outputs[i].orig_name,
			full_name: node.outputs[i].name,
			type: node.outputs[i].type,
		});
	}
	return data;
}

function link_shift_up(self, arr, index, flag, link_callback) {
	// Disconnect event handler
	const old_func = self.onConnectionsChange;
	self.onConnectionsChange = null;
	const old_in_func = self.onConnectInput;
	self.onConnectInput = null;
	const old_out_func = self.onConnectOutput;
	self.onConnectOutput = null;

	// Shift up all links
	for (; index < arr.length - 2; ++ index) {
		let last_pin = arr[index];
		last_pin.name = `${arr[index + 1].type}:${index - 1}`;
		last_pin.type = arr[index + 1].type;

		if (flag) {
			const old_length = arr[index + 1].links.length;
			for (let j = 0; j < old_length; ++ j) {
				const link = app.graph.links[arr[index + 1].links[0]];

				app.graph.getNodeById(link.target_id).disconnectInput(link.target_slot);

				self.connect(
					index,
					link.target_id,
					link.target_slot
				);
			}
		} else {
			const link = app.graph.links[arr[index + 1].link];

			self.disconnectInput(link.target_slot);

			app.graph.getNodeById(link.origin_id).connect(
				link.origin_slot,
				self,
				index
			);
		}
	}
	
	// Revert things back
	self.onConnectionsChange = old_func;
	self.onConnectInput = old_in_func;
	self.onConnectOutput = old_out_func;

	let last_pin = arr[arr.length - 2];
	last_pin.name = "..."; // String(this.outputs.length - 2);
	last_pin.type = "*";
}

const BLACKLIST = [
	"_pipe_in",
	"_pipe_out",
	"_junc_in",
	"_junc_out",
	"..."
];

app.registerExtension({
	name: "0246.Node",
	nodeCreated(node) {
		switch (node.getTitle()) {
			case "Highway": {
				node.color = LGraphCanvas.node_colors.brown.color;
				node.bgcolor = LGraphCanvas.node_colors.brown.bgcolor;
			} break;
			case "Junction": {
				node.color = LGraphCanvas.node_colors.blue.color;
				node.bgcolor = LGraphCanvas.node_colors.blue.bgcolor;
			} break;
		}
	},
	async beforeRegisterNodeDef (nodeType, nodeData, app) {
		if (nodeData.category === "0246") {
			switch (nodeData.name) {
				case "Highway": {
					nodeType.prototype.onNodeMoved = function () {};

					nodeType.prototype.onNodeCreated = function () {
						let last_query = "";

						init_type(this);

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

								// Clear all inputs and outputs except any that start with "_"
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
							// We detect if we're connecting to Reroute here by checking other_origin_node.type === "Reroute"
							// return false for not allowing connection

							if (BLACKLIST.includes(this.inputs[this_target_slot_index].name))
								return true;
							
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
							
							if (BLACKLIST.includes(this.outputs[this_origin_slot_index].name))
								return true;

							let curr_pin = this.outputs[this_origin_slot_index];

							
							if (other_target_node.__outputType) // Reroute
								curr_pin.type = other_target_node.__outputType;
							else if (other_target_node.defaultConnectionsLayout) // Reroute (rgthree)
								// rgthree accept this anyways so whatever since too lazy to properly do graph traversal
								curr_pin.type = other_target_slot_obj.type; 
							else
								curr_pin.type = other_target_slot_obj.type;

							curr_pin.name = `${curr_pin.type}:${curr_pin.orig_name}`;

							return true;
						};

						this.onConnectionsChange = function (type, index, connected, link_info) {
							if (link_info === null) {
								// Cleaning all type and name of in out
								for (let i = 1; i < this.inputs.length; ++ i) {
									this.inputs[i].name = this.inputs[i].orig_name;
									this.inputs[i].type = "*";
								}
								for (let i = 1; i < this.outputs.length; ++ i) {
									this.outputs[i].name = this.outputs[i].orig_name;
									this.outputs[i].type = "*";
								}
								this.computeSize();
								return;
							}

							if (!connected) {
								switch (type) {
									case 1: {
										if (!BLACKLIST.includes(this.inputs[link_info.target_slot].name)) {
											this.inputs[link_info.target_slot].name = this.inputs[link_info.target_slot].orig_name;
											this.inputs[link_info.target_slot].type = "*";
										}
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
				} break;
				case "Junction": {
					nodeType.prototype.onNodeMoved = function () {};

					nodeType.prototype.onNodeCreated = function () {
						init_type(this);

						this.addInput("...", "*");
						this.addOutput("...", "*");

						this.onConnectInput = function (
							this_target_slot_index,
							other_origin_slot_type,
							other_origin_slot_obj,
							other_origin_node,
							other_origin_slot_index
						) {
							// We detect if we're connecting to Reroute here by checking other_origin_node.type === "Reroute"
							// return false for not allowing connection

							if (
								BLACKLIST.includes(this.inputs[this_target_slot_index].name) &&
								this.inputs[this_target_slot_index].name !== "..."
							)
								return true;

							if (this.inputs[this_target_slot_index].link !== null) {
								// Forgot why this was here's but whatever
								app.graph.links[this.inputs[this_target_slot_index].link].replaced = true;
								return true;
							}
							
							let curr_pin = this.inputs[this_target_slot_index];
							curr_pin.type = other_origin_slot_obj.type;
							curr_pin.name = `${this_target_slot_index - 1}:${curr_pin.type}`;

							this.addInput("...", "*");

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
							
							if (
								BLACKLIST.includes(this.outputs[this_origin_slot_index].name) &&
								this.outputs[this_origin_slot_index].name !== "..."
							)
								return true;

							let curr_pin = this.outputs[this_origin_slot_index];

							if (curr_pin.links && curr_pin.links.length > 0)
								return true;

							if (other_target_node.__outputType) // Reroute
								curr_pin.type = other_target_node.__outputType;
							else if (other_target_node.defaultConnectionsLayout) // Reroute (rgthree)
								// rgthree accept this anyways so whatever since too lazy to properly do graph traversal
								// EDIT: I was wrong, I have to do it, but not here :(
								curr_pin.type = other_target_slot_obj.type;
							else
								curr_pin.type = other_target_slot_obj.type;

							curr_pin.name = `${curr_pin.type}:${this_origin_slot_index - 1}`;

							this.addOutput("...", "*");

							return true;
						};

						this.onConnectionsChange = function (type, index, connected, link_info) {
							if (link_info === null) {
								// Remove all elements from the arrays except for the first and last
								if (this.inputs.length > 2)
									this.inputs.splice(1, this.inputs.length - 2);
								if (this.outputs.length > 2)
									this.outputs.splice(1, this.outputs.length - 2);
								this.computeSize();
								return;
							}
							
							if (!connected) {
								switch (type) {
									case 1: {
										if (BLACKLIST.includes(this.inputs[link_info.target_slot].name) || link_info.replaced)
											return;
										link_shift_up(this, this.inputs, link_info.target_slot, false, (link_index, extra_link_index) => {
											return this.inputs[link_index].link;
										});
										this.removeInput(this.inputs.length - 1);
									} break;
									case 2: {
										if (BLACKLIST.includes(this.outputs[link_info.origin_slot].name))
											return;
										if (!this.outputs[link_info.origin_slot].links || this.outputs[link_info.origin_slot].links.length === 0) {
											link_shift_up(this, this.outputs, link_info.origin_slot, true, (link_index, extra_link_index) => {
												return this.outputs[link_index].links[extra_link_index];
											});
											this.removeOutput(this.outputs.length - 1);
										}
									} break;
									default: {
										throw new Error("Unsuported type: " + type);
									}
								}
							}
						};
					};
				} break;
			}
		}
	},
});