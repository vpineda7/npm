'use strict'
var safe = require('../utils/safe.js')

var defaultTemplate = {
  package: {
    dependencies: {},
    devDependencies: {},
    optionalDependencies: {},
    _requiredBy: [],
    _phantomChildren: {}
  },
  loaded: false,
  children: [],
  requiredBy: [],
  requires: [],
  missingDeps: {},
  missingDevDeps: {},
  path: null,
  realpath: null,
  userRequired: false,
  existing: false
}

function isLink (node) {
  return node && node.isLink
}


var create = exports.create = safe.recurseLimitSync(10, 100, function (node, template, $$recurse$$) {
  if (!$$recurse$$) {
    $$recurse$$ = template
    template = defaultTemplate
  }
  Object.keys(template).forEach(function (key) {
    if (template[key] != null && typeof template[key] === 'object' && !(template[key] instanceof Array)) {
      if (!node[key]) node[key] = {}
      return $$recurse$$(node[key], template[key])
    }
    if (node[key] != null) return
    node[key] = template[key]
  })
  if (isLink(node) || isLink(node.parent)) {
    node.isLink = true
  }
  return node
})

exports.reset = function (node) {
  reset(node, {})
}

var reset = safe.recurseLimitSync(100, 1000, function (node, seen, $$recurse$$) {
  if (seen[node.path]) return
  seen[node.path] = true
  var child = create(node)
  child.package._requiredBy = child.package._requiredBy.filter(function (req) {
    return req[0] === '#'
  })
  child.requiredBy = []
  child.package._phantomChildren = {}
  // FIXME: cleaning up after read-package-json's mess =(
  if (child.package._id === '@') delete child.package._id
  child.missingDeps = {}
  child.children.forEach(function (child) { $$recurse$$(child, seen) })
  if (!child.package.version) child.package.version = ''
})
