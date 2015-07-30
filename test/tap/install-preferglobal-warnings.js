var fs = require('graceful-fs')
var path = require('path')

var mkdirp = require('mkdirp')
var osenv = require('osenv')
var rimraf = require('rimraf')
var test = require('tap').test

var common = require('../common-tap.js')

var preferGlobalJson = {
  name: 'npm-test-preferglobal-dep',
  version: '0.0.0',
  preferGlobal: true
}

var dependenciesJson = {
  name: 'npm-test-preferglobal-dependency-check',
  version: '0.0.0',
  dependencies: {
    'npm-test-preferglobal-dep': 'file:../' + preferGlobalJson.name
  }
}

var devDependenciesJson = {
  name: 'npm-test-preferglobal-devDependency-check',
  version: '0.0.0',
  devDependencies: {
    'npm-test-preferglobal-dep': 'file:../' + preferGlobalJson.name
  }
}

test('install a preferGlobal dependency without warning', function (t) {
  setup(dependenciesJson)
  common.npm([
    'install',
    '--loglevel=warn'
  ], {}, function (err, code, stdout, stderr) {
    t.ifError(err, 'packages were installed')
    t.notMatch(
      stderr,
      /preferGlobal/,
      'install should not warn when dependency is preferGlobal')
    t.end()
  })
})

test('install a preferGlobal dependency without warning', function (t) {
  setup(devDependenciesJson)
  common.npm([
    'install',
    '--loglevel=warn'
  ], {}, function (err, code, stdout, stderr) {
    t.ifError(err, 'packages were installed')
    t.notMatch(
      stderr,
      /preferGlobal/,
      'install should not warn when devDependency is preferGlobal')
    t.end()
  })
})

test('cleanup', function (t) {
  cleanup()
  t.end()
})

function setup (json) {
  cleanup()
  mkPkg(preferGlobalJson)
  process.chdir(mkPkg(json))
}

function cleanup () {
  process.chdir(osenv.tmpdir())
  var pkgs = [preferGlobalJson, dependenciesJson, devDependenciesJson]
  pkgs.forEach(function (json) {
    rimraf.sync(path.resolve(__dirname, json.name))
  })
}

function mkPkg (json) {
  var pkgPath = path.resolve(__dirname, json.name)
  mkdirp.sync(pkgPath)
  fs.writeFileSync(
    path.join(pkgPath, 'package.json'),
    JSON.stringify(json, null, 2)
  )
  return pkgPath
}
