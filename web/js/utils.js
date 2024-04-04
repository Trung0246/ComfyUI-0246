import { ComfyDialog } from "../../../scripts/ui.js";

export async function try_import(name) {
	try {
		return await import(name);
	} catch (e) {
		return null;
	}
}
/*
export async function load_script(url) {
	return new Promise((resolve, reject) => {
		const script = document.createElement('script');
		script.type = 'text/javascript';
		script.src = url;

		script.onload = () => {
			resolve();
		};

		script.onerror = () => {
			reject(new Error(`Script load error for ${url}`));
		};

		document.head.appendChild(script);
	});
}
*/
export function compare_version(a, b) {
	for (let i = 0; i < a.length; ++ i) {
		if (a[i] > b[i])
			return 1;
		if (a[i] < b[i])
			return -1;
	}
	return 0;
}

export function error_popup(msg) {
	let dialog = new ComfyDialog();
	dialog.show(`<p>${msg}</p>`);
}

export function is_promise(obj) {
	return !!obj && (typeof obj === 'object' || typeof obj === 'function') && typeof obj.then === 'function';
}

export function is_async(func) {
	return func.constructor.name === "AsyncFunction";
}

export const HIJACK_MARK = Symbol("hijack_mark");

function hijack_evt(evt_obj, pass_obj, mode) {
	for (let i = 0; i < evt_obj.evt.length; ++ i)
		evt_obj.evt[i].call(pass_obj, mode);
}

export function hijack(obj, key, func, evt) {
	// The most convoluted hijacking mechanism ever
	const old_func = obj[key] ?? (() => {}),
		evt_obj = old_func[HIJACK_MARK] ?? {
			evt: [],
		};

	obj[key] = function(...args) {
		const self = this;
		const pass_obj = {
			self: self,
			stop: false,
			func: func,
			old: old_func,
			args: args,
			wait: is_async(old_func) || is_async(func),
		};

		const exec_after = () => {
			hijack_evt(evt_obj, pass_obj, 0b10000);
			const after_result = func.apply(pass_obj, args);
			hijack_evt(evt_obj, pass_obj, 0b100000);

			if (is_promise(after_result))
				// return after_result.then(() => pass_obj.res);
				return after_result.then(() => {
					hijack_evt(evt_obj, pass_obj, 0b100000000);
					return pass_obj.res;
				});
			return pass_obj.res;
		};

		const exec_old = () => {
			if (pass_obj.old !== old_func || pass_obj.stop) {
				hijack_evt(evt_obj, pass_obj, 0b1000000);
				if (is_promise(pass_obj.res))
					// return pass_obj.res.then(exec_after);
					return pass_obj.res.then(res => {
						pass_obj.res = res;
						hijack_evt(evt_obj, pass_obj, 0b10000000);
						return exec_after();
					});
				return exec_after();
			}

			hijack_evt(evt_obj, pass_obj, 0b100);
			const result = old_func.apply(self, args);
			hijack_evt(evt_obj, pass_obj, 0b1000);

			if (is_promise(result))
				return result.then(res => {
					pass_obj.res = res;
					return exec_after();
				});
			pass_obj.res = result;
			return exec_after();
		};

		hijack_evt(evt_obj, pass_obj, 0b1);
		const before_result = func.apply(pass_obj, args);
		hijack_evt(evt_obj, pass_obj, 0b10);

		pass_obj.mark = true;
		if (is_promise(before_result))
			return before_result.then(exec_old);
		return exec_old();
	};

	obj[key][HIJACK_MARK] = evt_obj;

	if (evt)
		obj[key][HIJACK_MARK].evt.push(evt);

	return old_func;
}

export function clone_class(original) {
	return class extends original {
		constructor(...args) {
			super(...args);
		}
	};
}

export function remove_elem_arr(array, chk_fn) {
	let shift = 0;

	for (let i = 0; i < array.length; ++i) {
		if (chk_fn(array[i], i, array))
			++ shift;
		else if (shift > 0)
			array[i - shift] = array[i];
	}

	array.length -= shift;
}

export function reverse_array(arr, start, end) {
	// Function to reverse a portion of the array

	while (start < end) {
		let temp = arr[start];
		arr[start] = arr[end];
		arr[end] = temp;
		start++;
		end--;
	}
}

export function rotate_array(arr, n) {
	const length = arr.length;
	// Normalize the rotation count
	n = n % length;
	if (n < 0)
		// Convert negative rotation to positive equivalent
		n += length;

	// Reverse the whole array
	reverse_array(arr, 0, length - 1);
	// Reverse the first part
	reverse_array(arr, 0, n - 1);
	// Reverse the second part
	reverse_array(arr, n, length - 1);

	return arr;
}

export function equal_array(a, b, m = false, w = null) {
	if (a.length !== b.length)
		return false;

	if (m) {
		for (let i = 0; i < a.length; ++ i)
			if (b.indexOf(a[i]) === -1)
				return false;
	} else for (let i = 0; i < a.length; ++ i) {
		if (a[i] === w || b[i] === w)
			continue;
		if (a[i] !== b[i])
			return false;
	}
	return true;
}

export function equal_dict(a, b, m = false, w = null) {
	if (!m && Object.keys(a).length !== Object.keys(b).length)
		return false;
	for (let key in a) {
		if (m && !(key in b))
			continue;
		if (w !== null && (a[key] === w || b[key] === w))
			continue;
		if (a[key] !== b[key])
			return false;
	}
	return true;
}

export function find_key_dict(dict, key) {
	const key_list = Object.keys(dict);
	let res = [];
	for (let i = 0; i < key_list.length; ++ i)
		if (typeof key === "string" && key_list[i].indexOf(key) != -1)
			res.push(key_list[i]);
		else if (typeof key === "function" && key(key_list[i]))
			res.push(key_list[i]);
	return res;
}

export function update_dict(a, b) {
	for (let key in a)
		if (b.hasOwnProperty(key))
			a[key] = b[key];
}

export class RingBuffer {
	constructor(size) {
		this.buffer = [];
		this.prev = [];
		this.index = 0;
		this.size = size;
		this.count = 0;
		this.dirty = false;
	}

	push(value) {
		this.buffer[this.index] = value;
		this.index = (this.index + 1) % this.size;
		++ this.count;
		if (this.count > this.size) {
			this.count = this.size;
			this.dirty = true;
		}
	}

	at(index) {
		if (index >= this.count)
			return undefined;
		index = (this.index - index - 1 + this.size) % this.size;
		return this.buffer[index];
	}

	*[Symbol.iterator]() {
		for (let i = 0; i < this.count; ++ i)
			yield this.at(i);
	}

	clean() {
    if (!this.dirty) return;
		this.dirty = false;
		this.prev.length = 0;
		for (let i = 0; i < this.count; ++ i)
			this.prev[i] = this.at(i);

		let temp = this.buffer;
		this.buffer = this.prev;
		this.prev = temp;
		this.index = this.count % this.size;
	}

	resize(size) {
		if (this.dirty)
			this.clean();

		this.buffer.length = size;
		this.prev.length = 0;
		this.size = size;
		if (this.size < this.count)
			this.count = this.size;
		this.index = this.count % size;
	}

	pull(index) {
		if (index >= this.count) return undefined;
		
		this.clean();

		let actual_index = (this.index - index - 1 + this.size) % this.size,
			value = this.buffer[actual_index];

		for (let i = actual_index; i != this.index; i = (i + 1) % this.size)
			this.buffer[i] = this.buffer[(i + 1) % this.size];

		-- this.count;
		this.index = (this.index - 1 + this.size) % this.size;

		return value;
	}
}

export function random_id() {
	return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

export function rand_int(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function indent_str(strings, ...values) {
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

export function hex_to_rgb(hex) {
	if (hex.startsWith("#"))
		hex = hex.slice(1);
	if (hex.length === 3)
		hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
	let bigint = parseInt(hex, 16);
	return [
		(bigint >> 16) & 255,
		(bigint >> 8) & 255,
		bigint & 255
	];
}

export function rgb_to_hex(r, g, b) {
	return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

export function rgb_to_hsl(r, g, b) {
	r /= 255, g /= 255, b /= 255;
	let max = Math.max(r, g, b), min = Math.min(r, g, b),
		h, s, l = (max + min) / 2;

	if (max === min)
		h = s = 0; // achromatic
	else {
		let d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		switch (max) {
			case r: h = (g - b) / d + (g < b ? 6 : 0); break;
			case g: h = (b - r) / d + 2; break;
			case b: h = (r - g) / d + 4; break;
		}
		h /= 6;
	}

	return [h, s, l];
}

export function hue_to_rgb(p, q, t) {
	if (t < 0) t += 1;
	if (t > 1) t -= 1;
	if (t < 1/6) return p + (q - p) * 6 * t;
	if (t < 1/2) return q;
	if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
	return p;
}

export function hsl_to_rgb(h, s, l) {
	let r, g, b;

	if (s === 0)
		r = g = b = l; // achromatic
	else {
		let q = l < 0.5 ? l * (1 + s) : l + s - l * s,
			p = 2 * l - q;
		r = hue_to_rgb(p, q, h + 1/3);
		g = hue_to_rgb(p, q, h);
		b = hue_to_rgb(p, q, h - 1/3);
	}

	return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

export function mix_color_hue(color1, color2) {
	let hsl1 = rgb_to_hsl(...hex_to_rgb(color1)),
		hsl2 = rgb_to_hsl(...hex_to_rgb(color2));

	return rgb_to_hex(...hsl_to_rgb(
		(hsl1[0] + hsl2[0]) / 2,
		(hsl1[1] + hsl2[1]) / 2, 
		(hsl1[2] + hsl2[2]) / 2
	));
}

export function mix_color(color1, color2) {
	let rgb1 = hex_to_rgb(color1), rgb2 = hex_to_rgb(color2);

	return rgb_to_hex(
		Math.round(Math.sqrt(rgb1[0] * rgb1[0] + rgb2[0] * rgb2[0])),
		Math.round(Math.sqrt(rgb1[1] * rgb1[1] + rgb2[1] * rgb2[1])),
		Math.round(Math.sqrt(rgb1[2] * rgb1[2] + rgb2[2] * rgb2[2]))
	);
}

export function norm(val, min, max) {
	return (val - min) / (max - min);
}

export function lerp(norm, min, max) {
	return (max - min) * norm + min;
}

export function map(val, src_min, src_max, dst_min, dst_max) {
	return lerp(norm(val, src_min, src_max), dst_min, dst_max);
}

export function is_inside_rect(
	this_x, this_y,
	other_x, other_y, other_w, other_h
) {
	return this_x >= other_x && this_x <= other_x + other_w && this_y >= other_y && this_y <= other_y + other_h;
}

export function is_inside_rect_rect(
	this_x, this_y, this_w, this_h,
	other_x, other_y, other_w, other_h
) {
	return this_x >= other_x && this_x + this_w <= other_x + other_w && this_y >= other_y && this_y + this_h <= other_y + other_h;
}

export function is_inside_circ(
	this_x, this_y,
	other_x, other_y, other_r,
) {
	return Math.pow(this_x - other_x, 2) + Math.pow(this_y - other_y, 2) <= (other_r * other_r);
}

export function calc_resize(
	x, y, w, h,
	other_x, other_y
) {
	if (
		other_x >= x &&
		other_y >= y
	) {
		// Case 1: Mouse moves right-bottom
		w = other_x - x;
		h = other_y - y;
	} else if (
		other_x < x &&
		other_y < y
	) {
		// Case 2: Mouse moves left-top
		w = x - other_x;
		h = y - other_y;
		x = other_x;
		y = other_y;
	} else if (
		other_x < x &&
		other_y >= y
	) {
		// Case 3: Mouse moves left-bottom
		w = x - other_x;
		h = other_y - y;
		x = other_x;
	} else if (
		other_x >= x &&
		other_y < y
	) {
		// Case 4: Mouse moves right-top
		w = other_x - x;
		h = y - other_y;
		y = other_y;
	}

	return [x, y, w, h];
}

export function calc_flex_norm(
	x, y, w, h,
	this_x, this_y, this_w, this_h,
	other_x, other_y, other_w, other_h,
) {
	return [
		(x - this_x) / this_w * other_w + other_x,
		(y - this_y) / this_h * other_h + other_y,
		w / this_w * other_w,
		h / this_h * other_h,
	];
}

export function calc_area(margin_x, margin_head_y, margin_tail_y, width, height, max_height, ratio, center, at_y, flag = false, area = []) {
	area[0] = margin_x;
	area[1] = margin_head_y + at_y;

	area[2] = width - margin_x * 2;
	area[3] = height - margin_head_y - margin_tail_y;// - at_y;

	area[3] = Math.min(area[3], max_height);

	if (flag && area[2] < 0)
		area[2] = 0;

	if (ratio !== 0) {
		if (ratio < 1) {
			if (area[3] * ratio > area[2])
				area[3] = area[2] / ratio;
			else
				area[2] = area[3] * ratio;
		} else {
			if (area[2] / ratio > area[3])
				area[2] = area[3] * ratio;
			else
				area[3] = area[2] / ratio;
		}
		if (center)
			area[0] = (width - area[2]) / 2;
	}

	if (flag && area[3] < 0) {
		area[2] = 0;
		area[3] = 0;
	}

	return area;
}

export function calc_spread(count, total, weight, min, max) {
	let total_weight = weight.reduce((a, b) => a + b, 0),
		res = new Array(count).fill(0),
		allow = new Array(count).fill(true),
		remain = total;

	for (let i = 0; i < count; ++ i) {
		res[i] = weight[i] / (total_weight === 0 ? 1 : total_weight) * total;
		if (min[i] !== null && res[i] < min[i]) {
			res[i] = min[i];
			remain -= min[i];
			total_weight -= weight[i];
			allow[i] = false;
		}
		if (max[i] !== null && res[i] > max[i]) {
			res[i] = max[i];
			remain -= max[i];
			total_weight -= weight[i];
			allow[i] = false;
		}
	}

	for (let i = 0; i < count; ++ i)
		if (allow[i])
			res[i] = weight[i] / (total_weight === 0 ? 1 : total_weight) * remain;

	return res;
}

export function round(num, dec) {
	const mult = Math.pow(10, dec);
	return Math.round(num * mult) / mult;
}

export function floor(num, dec) {
	const mult = Math.pow(10, dec);
	return Math.floor(num * mult) / mult;
}

export function snap(num, step) {
	if (num > 0)
		return Math.floor(num / step) * step;
	return Math.ceil(num / step) * step;
}

export function multi_snap(num, len, fn) {
	if (num < fn(0) || num > fn(len - 1))
		return null;
	
	let closest = 0,
		min_diff = Math.abs(num - fn(0));

	for (let i = 1; i < len; ++ i) {
		let diff = Math.abs(num - fn(i));
		if (diff < min_diff) {
			min_diff = diff;
			closest = i;
		}
	}

	return closest;
}

export function rem(a, b) {
	return (a % b + b) % b;
}

export function text_snip(text, max_len) {
	if (text.length <= max_len)
		return text;
	return text.slice(0, 3) + "..." + text.slice(-3);
}

export async function safe_eval(code) {
	// https://github.com/Prendus/secure-eval/blob/master/secure-eval.ts
	const secureEvalIframe = document.createElement('iframe');
	secureEvalIframe.setAttribute('sandbox', 'allow-scripts');
	secureEvalIframe.setAttribute('style', 'display: none;');
	secureEvalIframe.setAttribute('src', 'data:text/html;base64,' + btoa(`
		<script type="module">
			try {
				${norm.toString()}
				${lerp.toString()}
				${is_inside_rect.toString()}
				${is_inside_rect_rect.toString()}
				${is_inside_circ.toString()}
				${calc_resize.toString()}
				${calc_flex_norm.toString()}
				${calc_area.toString()}
				${round.toString()}
				${floor.toString()}
				${snap.toString()}
				${rem.toString()}
				window.parent.postMessage({
					type: 'secure-eval-iframe-result',
					data: (function() {
						${code}
					})()
				}, '*');
			}
			catch(error) {
				window.parent.postMessage({
					type: 'secure-eval-iframe-result',
					error: error.toString()
				}, '*');
			}
		</script>
	`));

	document.body.appendChild(secureEvalIframe);

	return new Promise((resolve, reject) => {
		const windowListener = event => {
			if (event.data.type !== 'secure-eval-iframe-result')
				return;
			window.removeEventListener('message', windowListener);
			document.body.removeChild(secureEvalIframe);
			if (event.data.error)
				reject(new Error(event.data.error));
			else
				resolve(event.data.data);
		};

		window.addEventListener('message', windowListener);
		secureEvalIframe.addEventListener('load', () => {
			secureEvalIframe.contentWindow.postMessage(code, '*');
		});
	});
}

export function dummy(...args) {
	return args[0];
}