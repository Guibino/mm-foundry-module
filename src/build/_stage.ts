import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { paths } from "../config.js";
import { toActor } from "../normalize/dnd5e.js";
const OUT = "/tmp/mm_source";
const slug=(s:string)=>s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"").slice(0,60);
const monsters=JSON.parse(await readFile(paths.monstersPt,"utf8"));
await rm(OUT,{recursive:true,force:true}); await mkdir(OUT,{recursive:true});
const seen=new Set<string>(); let n=0;
for(const m of monsters){const a=toActor(m);let s=slug(a.flags.mm2024.nameEn||a.name)||"monstro";while(seen.has(s))s+="-2";seen.add(s);await writeFile(path.join(OUT,`${s}.json`),JSON.stringify(a,null,2));n++;}
console.log("staged",n,"-> "+OUT);
