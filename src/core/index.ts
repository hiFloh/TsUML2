import { renderNomnomlSVG } from "./io";
import { getAst, parseClasses, parseInterfaces, parseClassHeritageClauses, parseInterfaceHeritageClauses, parseEnum } from "./parser";
import { emitSingleClass, emitSingleInterface, emitHeritageClauses, postProcessSvg, emitSingleEnum } from "./emitter";
import { SETTINGS, TsUML2Settings } from "./tsuml2-settings";
import chalk from 'chalk';
import { FileDeclaration } from "./model";
import * as fs from 'fs';

function parse(tsConfigPath: string, pattern: string): FileDeclaration[] {
  const ast = getAst(tsConfigPath, pattern);
  const files = ast.getSourceFiles();
  // parser
  console.log(chalk.yellow("parsing source files:"));
  const declarations: FileDeclaration[] = files.map(f => {
    var classes = f.getClasses();
    
    var interfaces = f.getInterfaces();
    var enums = f.getEnums();
    const path = f.getFilePath();
    f.getModules().forEach(m=>{
      classes=classes.concat(m.getClasses())
      interfaces=interfaces.concat(m.getInterfaces())
      enums=enums.concat(m.getEnums())
    })
    console.log(chalk.yellow(path));
    return {
      fileName: path,
      classes: classes.map(parseClasses),
      interfaces: interfaces.map(parseInterfaces),
      enums: enums.map(parseEnum),
      heritageClauses: [...classes.map(parseClassHeritageClauses),...interfaces.map(parseInterfaceHeritageClauses)]
    };
  });
  return declarations;
}

function emit(declarations: FileDeclaration[]) {
  const entities = declarations.map(d => {
    console.log(chalk.yellow(d.fileName));
    const classes = d.classes.map((c) => emitSingleClass(c));
    const interfaces = d.interfaces.map((i) => emitSingleInterface(i));
    const enums = d.enums.map((i) => emitSingleEnum(i));
    const heritageClauses = d.heritageClauses.map(emitHeritageClauses);
    return [...classes, ...interfaces, ...enums, ...heritageClauses.flat()];
  });

  return getStyling() + entities.flat().join("\n");
}

function getStyling(): string {
  return '#.interface: fill=lightblue\n' +
    '#.enumeration: fill=lightgreen\n' +
    SETTINGS.nomnoml.join("\n");
}

export function createNomnomlSVG(settings: TsUML2Settings) {

  // parse
  const declarations = parse(settings.tsconfig, settings.glob)
  if(declarations.length === 0) {
    console.log(chalk.red("\nno declarations found! tsconfig: " + settings.tsconfig, " glob: " + settings.glob));
    return;
  }

  // emit
  console.log(chalk.yellow("\nemitting declarations:"));
  const dsl = emit(declarations);

  if(SETTINGS.outDsl !== "") {
    console.log(chalk.green("\nwriting DSL"));
    fs.writeFile(SETTINGS.outDsl,dsl,(err) => {
      if(err) {
          console.log(chalk.redBright("Error writing DSL file: " + err));
      }
    });
  }

  //render
  console.log(chalk.yellow("\nrender to svg"));
  let svg = renderNomnomlSVG(dsl);
  if(settings.typeLinks) {
    console.log(chalk.yellow("\nadding type links to svg"));
    svg = postProcessSvg(svg,settings.outFile, declarations);
  }

  console.log(chalk.green("\nwriting SVG"));
  fs.writeFile(SETTINGS.outFile,svg,(err) => {
    if(err) {
        console.log(chalk.redBright("Error writing file: " + err));
    }
  });

  return svg;
}
