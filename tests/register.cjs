const fs = require('node:fs')
const typescript = require('typescript')

const compile = (loadedModule, filename) => {
  const source = fs.readFileSync(filename, 'utf8')
  const compiled = typescript.transpileModule(source, {
    fileName: filename,
    compilerOptions: {
      module: typescript.ModuleKind.CommonJS,
      target: typescript.ScriptTarget.ES2020,
      jsx: typescript.JsxEmit.ReactJSX,
      esModuleInterop: true
    }
  })
  loadedModule._compile(compiled.outputText, filename)
}

require.extensions['.ts'] = compile
require.extensions['.tsx'] = compile
