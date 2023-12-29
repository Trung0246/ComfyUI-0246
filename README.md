# ComfyUI-0246
Random nodes for ComfyUI I made to solve my struggle with ComfyUI. Have varying quality.

![image](https://github.com/Trung0246/ComfyUI-0246/assets/11626920/ecd1078a-037a-4ba2-9a0b-440db9bf6cc1)

# Nodes list

Piping:
- `Highway`: yet another implementation but overkill version of pipe and reroute.
- `HighwayBatch`: batching version of `Highway`.
- `Junction`: over-the-head data packing and unpacking sequentially.
- `JunctionBatch`: if `Junction` and ComfyUI batching have a kid.
- `Merge`: pipe and batch merging.

Misc:
- `BoxRange`: visualization of boxes. usefull for anything that requires boxes (which is `x`, `y`, `width`, `height`).
    - Currently only `ConditioningSetAreaPercentage`. More will come in the future.
    - Double click on each corner and discover what each will do.
- `Beautify`: the beautification of data for easy troubleshooting.
- `Stringify`: anything to string, optionally together.
- `RandomInt`: different from other implementation such that it generate number server side to works with `Loop`.
- `Hub`: widget management to the max.
    - Image display does not work for now, alongside with other 3rd party custom. But it should generally stable.
- `CastReroute`: basically like `Reroute` but have ability to specify custom type. Useful when dealing with `Highway`, `Junction` and such.

Control Flow:
- `Loop`: very hacky recursive repetition by messing with ComfyUI internals.
- `Hold`: hold data between each loop execution.
- `Count`: simple counter to use with `Loop`.

"Execute anything" node:
- `ScriptNode`
- `ScriptRule`
- `Script`

---

### Update

#### **2023-12-19**

Tons more nodes. Here's the simple workflow image that showcase everything within this update.

For any nodes related to `Script`, `*_order` widget will determine script execution order, which depends on [natsort](https://natsort.readthedocs.io/en/stable/api.html#the-ns-enum). How it being sorted can be customized by doing things like `INT, LOCALE` within the `_sort_mode` widget.

Warning: The recent changes I have changed how Highway and Junction tracking types. Therefore the best way to mitigrate this is to just copy the `_query` or `_offset`, create a new Highway or Junction, paste the string then reconnect everything over. I've probably find a way to automate this.

I recommended you to play around with this sample workflow:

<details>
    <p align="center">
        <img src="https://github.com/Trung0246/ComfyUI-0246/assets/11626920/05d53d43-a707-4c49-bbc9-cbaf98f70cc0">
    </p>
</details>

---

##### TODO (may or may not get implemented)

- Tutorial for various nodes.
- More testing.
