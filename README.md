# ComfyUI-0246
Random nodes for ComfyUI I made to solve my struggle with ComfyUI. Have varying quality.

# Nodes list

- `Highway`: yet another implementation but overkill version of pipe and reroute.

---

### Highway

<p align="center">
    <img src="https://raw.githubusercontent.com/Trung0246/ComfyUI-0246/main/assets/Screenshot%202023-11-05%20181932.png">
</p>

The query syntax goes as follow:

- `>name`: input variable.
- `<name`: output variable.
- `` >`n!ce n@me` ``: input variable but with special character and spaces (except `` ` ``, obviously).
- `!name`: output variable, but also delete itself, preventing from being referenced further.
  -  CURRENTLY BROKEN DUE TO HOW COMFYUI UPDATE THE NODES.
-  `<name1; >name2; !name3`: multiple input and outputs together.

For now `Highway` node is probably stable, as long as there's no cyclic connection.
  - Cyclic connection means that input and output of the same `Highway` node must not be connect, including indirect connection.
    - Else will be recursion error due to how ComfyUI execute nodes (trust me I tried).

Can probably have "nested Highway" but probably useless since the node have unlimited in-out pins.

Demo workflow is in [assets/workflow_highway.json](https://github.com/Trung0246/ComfyUI-0246/blob/main/assets/workflow_highway.json).

Special thanks to [@kijai](https://github.com/kijai/ComfyUI-KJNodes) for `ConditioningMultiCombine` node as which `Highway` node is based of.
   
##### TODO (may or may not get implemented)

- Cyclic detection in JS (python probably not possible unless I figure out a way how to extract the node graph).
- Type validation check (`Highway` due to it's functionality, the implementation disabled the validation checking (only for `Highway`) through hacky python stuff).
- Node force update (for `!name`).
