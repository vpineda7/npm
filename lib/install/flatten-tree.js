'use strict'
var validate = require('aproba')
var safe = require('../utils/safe.js')

module.exports = function (tree) {
  validate('O', arguments)
  var seen = {}
  var flat = {}
  var todo = [[tree, '/']]
  safe.whileSync(1000, function () { return todo.length }, function () {
    var next = todo.shift()
    var pkg = next[0]
    seen[pkg.path] = true
    var path = next[1]
    flat[path] = pkg
    if (path !== '/') path += '/'
    for (var ii = 0; ii < pkg.children.length; ++ii) {
      var child = pkg.children[ii]
      if (!seen[child.path]) {
        todo.push([child, flatName(path, child)])
      }
    }
  })
  return flat
}

var flatName = module.exports.flatName = function (path, child) {
  validate('SO', arguments)
  return path + (child.package.name || 'TOP')
}
