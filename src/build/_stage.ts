import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { paths } from "../config.js";
import { toActor } from "../normalize/dnd5e.js";
import { buildTypeFolders } from "../normalize/folders.js";
import { glossary } from "../translate/glossary.js";
const OUT = "/tmp/mm_source";
const slug=(s:string)=>s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"").slice(0,60);
const monsters=JSON.parse(await readFile(paths.monstersPt,"utf8"));
await rm(OUT,{recursive:true,force:true}); await mkdir(OUT,{recursive:true});
const typeKeys=new Set<string>(monsters.map((m:any)=>glossary.typeKeys[m.type]??"unknown"));
const {docs:folders,byType}=buildTypeFolders(typeKeys);
for(const f of folders) await writeFile(path.join(OUT,`_folder-${f._id}.json`),JSON.stringify(f,null,2));
const seen=new Set<string>(); let n=0;
for(const m of monsters){const key=glossary.typeKeys[m.type]??"unknown";const a=toActor(m,byType.get(key));let s=slug(a.flags.mm2024.nameEn||a.name)||"monstro";while(seen.has(s))s+="-2";seen.add(s);await writeFile(path.join(OUT,`${s}.json`),JSON.stringify(a,null,2));n++;}
console.log("staged",n,"em",folders.length,"pastas -> "+OUT);
