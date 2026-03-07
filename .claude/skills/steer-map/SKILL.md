---
description: "Rebuild or query the codebase map"
argument-hint: "[module-name]"
---

Interact with the codebase map.

Arguments provided: $ARGUMENTS

If a module name was provided, query the map for that module by reading `.steer/codebase-map.json`.
Otherwise, ask the user if they want to rebuild the map or query a specific module.

## Pre-check
Before running the command, verify `.steer/` exists in the project root (or a parent directory).
If not found, inform the user: "SteerAgent is not initialized in this project. Run `steer-agent init` to set it up."

## Rebuild

To rebuild the map, run via Bash:
```
node -e "const{buildCodebaseMap}=require('@steer-agent-tool/core');(async()=>{const m=await buildCodebaseMap(process.cwd());require('fs').writeFileSync(require('path').join(process.cwd(),'.steer','codebase-map.json'),JSON.stringify(m,null,2));console.log(JSON.stringify({status:'rebuilt',modules:Object.keys(m.modules).length,files:Object.keys(m.files).length}))})()"
```

## Query

To query, read `.steer/codebase-map.json` and look up the requested module or file path.
