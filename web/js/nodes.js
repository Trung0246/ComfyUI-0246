import { app } from "../../../scripts/app.js";
import { ComfyDialog } from "../../../scripts/ui.js";

function error_popup(msg) {
	let dialog = new ComfyDialog();
	dialog.show(`<p>${msg}</p>`);
}

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

function connection_handle(node, type, index, connected, link_info, exclude_type, name_callback) {
	if (link_info instanceof Object) {
		switch (type) {
			case 1: {
				// Input
				// link_info.target_slot from 1 forward
				const pin_obj = node.inputs[link_info.target_slot];
				if (connected) {
					const link = app.graph.links[link_info.id];
					const data_type = app.graph.getNodeById(link.origin_id).outputs[link.origin_slot]?.type ?? "*";

					if (data_type === exclude_type && link_info.target_slot === 0)
						return

					if (pin_obj.type === "*") {
						pin_obj.type = data_type;
						name_callback?.(pin_obj, data_type, false);
					}

					link.color = LGraphCanvas.link_type_colors[data_type];
				} else {
					if (pin_obj.type === exclude_type && link_info.target_slot === 0)
						return

					pin_obj.type = "*";
					name_callback?.(pin_obj, "*", false);
				}
				node.size = node.computeSize();
			} break;
			case 2: {
				// Output
				// link_info.origin_slot from 1 forward
				const pin_obj = node.outputs[link_info.origin_slot];
				if (connected) {
					const link = app.graph.links[link_info.id];
					const data_type = app.graph.getNodeById(link.target_id).inputs[link.target_slot]?.type ?? "*";

					if (data_type === exclude_type && link_info.origin_slot === 0)
						return

					if (pin_obj.type === "*") {
						pin_obj.type = data_type;
						name_callback?.(pin_obj, data_type, true);
					}
				} else {
					if (pin_obj.type === exclude_type && link_info.origin_slot === 0)
						return
					
					if (pin_obj.links.length === 0) {
						pin_obj.type = "*";
						name_callback?.(pin_obj, "*", true);
					}
				}
				node.size = node.computeSize();
			} break;
			default: {
				throw new Error("Unsuported type: " + type);
			}
		}
	}
}

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
								if (this.inputs[i].name[0] !== "_" && this.inputs[i].link !== null)
									prev.push({
										flag: false,
										name: this.inputs[i].orig_name,
										node_id: app.graph.links[this.inputs[i].link].origin_id,
										slot_id: app.graph.links[this.inputs[i].link].origin_slot,
									});
							}
							for (let i = 0; i < this.outputs.length; ++ i) {
								if (this.outputs[i].name[0] !== "_" && this.outputs[i].links !== null)
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
								if (this.inputs[i].name[0] !== "_")
									this.removeInput(i);
							}
							for (let i = this.outputs.length; i -- > 0;) {
								if (this.outputs[i].name[0] !== "_")
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

					this.onConnectionsChange = function (type, index, connected, link_info) {
						connection_handle(this, type, index, connected, link_info, "HIGHWAY_PIPE", (pin_obj, data_type, is_output) => {
							if (is_output) {
								if (data_type === "*")
									pin_obj.name = pin_obj.orig_name;
								else
									pin_obj.name = `${data_type}:${pin_obj.orig_name}`;
							} else {
								if (data_type === "*")
									pin_obj.name = pin_obj.orig_name;
								else
									pin_obj.name += `:${data_type}`;
							}
						});
					};
				};
			} break;
			case "Junction": {
				nodeType.prototype.onNodeMoved = function () {};

				nodeType.prototype.onNodeCreated = function () {
					init_type(this);

					this.addInput("...", "*");
					this.addOutput("...", "*");

					this.onConnectionsChange = function (type, index, connected, link_info) {
						if (link_info === null) {
							// Clean input/output
							for (let i = 1; i < this.inputs.length - 1; ++ i)
								this.inputs.splice(i, 1);
							for (let i = 1; i < this.outputs.length - 1; ++ i)
								this.outputs.splice(i, 1);
							return;
						}

						connection_handle(this, type, index, connected, link_info, "JUNCTION_PIPE", (pin_obj, data_type, is_output) => {
							if (is_output) {
								if (data_type === "*") {
									if (pin_obj.links.length === 0) {
										pin_obj.name = String(link_info.origin_slot - 1);
										
										// Check for closest empty output
										let res_index = 1;
										scope: {
											for (; res_index < this.outputs.length; ++ res_index)
												if (this.outputs[res_index].links.length === 0)
													break scope;
											this.removeOutput(this.outputs.length - 1);
											return;
										}
										
										// Disconnect event handler
										const old_func = this.onConnectionsChange;
										this.onConnectionsChange = null;

										// Shift up all links
										for (; res_index < this.outputs.length - 2; ++ res_index) {
											let old_length = this.outputs[res_index + 1].links.length,
												last_pin = this.outputs[res_index];

											last_pin.name = `${this.outputs[res_index + 1].type}:${res_index - 1}`;
											last_pin.type = this.outputs[res_index + 1].type;

											for (let j = 0; j < old_length; ++ j) {
												const link = app.graph.links[this.outputs[res_index + 1].links[0]];

												app.graph.getNodeById(link.target_id).disconnectInput(link.target_slot);

												this.connect(
													res_index,
													link.target_id,
													link.target_slot
												);
											}
										}
										
										// Revert things back
										this.onConnectionsChange = old_func;

										this.removeOutput(this.outputs.length - 1);

										let last_pin = this.outputs[this.outputs.length - 1];
										last_pin.name = "..."; // String(this.outputs.length - 2);
										last_pin.type = "*";
									}
								} else {
									pin_obj.name = `${data_type}:${link_info.origin_slot - 1}`;
									this.addOutput("...", "*");
								}
							} else {
								if (data_type === "*") {
									pin_obj.name = String(link_info.origin_slot - 1);
									
									// Check for closest empty output
									let res_index = 1;
									scope: {
										for (; res_index < this.inputs.length; ++ res_index)
											if (!this.inputs[res_index].link)
												break scope;
										this.removeOutput(this.inputs.length - 1);
										return;
									}

									// Disconnect event handler
									const old_func = this.onConnectionsChange;
									this.onConnectionsChange = null;

									// Shift up all links
									for (; res_index < this.inputs.length - 2; ++ res_index) {
										let last_pin = this.inputs[res_index];

										last_pin.name = `${res_index - 1}:${this.inputs[res_index + 1].type}`;
										last_pin.type = this.inputs[res_index + 1].type;

										const link = app.graph.links[this.inputs[res_index + 1].link];

										this.disconnectInput(link.target_slot);

										app.graph.getNodeById(link.origin_id).connect(
											link.origin_slot,
											this,
											res_index
										);
									}

									// Revert things back
									this.onConnectionsChange = old_func;

									this.removeInput(this.inputs.length - 1);

									let last_pin = this.inputs[this.inputs.length - 1];
									last_pin.name = "..."; // String(this.inputs.length - 2);
									last_pin.type = "*";
								} else {
									pin_obj.name = `${link_info.target_slot - 1}:${data_type}`;
									this.addInput("...", "*");
								}
							}
						});
					};
				};
			} break;
		}
	},
});