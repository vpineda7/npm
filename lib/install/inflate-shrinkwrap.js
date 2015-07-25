'use strict'
var path = require('path')
var url = require('url')
var asyncMap = require('slide').asyncMap
var validate = require('aproba')
var iferr = require('iferr')
var limit = require('call-limit')
var safe = require('../utils/safe.js')
var fetchPackageMetadata = limit(require('../fetch-package-metadata.js'), 5)
var addShrinkwrap = limit(require('../fetch-package-metadata.js').addShrinkwrap, 1)
var addBundled = limit(require('../fetch-package-metadata.js').addBundled, 1)
var inflateBundled = require('./inflate-bundled.js')
var npm = require('../npm.js')
var createChild = require('./node.js').create

module.exports = safe.recurseLimitSync(100, 1000, function (tree, swdeps, finishInflating, $$recurse$$) {
  validate('OOFF', arguments)
  if (!npm.config.get('shrinkwrap')) return finishInflating()
  var onDisk = {}
  tree.children.forEach(function (child) { onDisk[child.package.name] = child })
  tree.children = []
  asyncMap(Object.keys(swdeps), function (name, next) {
    var sw = swdeps[name]
    var spec = sw.resolved
             ? name + '@' + sw.resolved
             : (sw.from && url.parse(sw.from).protocol)
             ? name + '@' + sw.from
             : name + '@' + sw.version
    var child = onDisk[name]
    if (child && (child.fromShrinkwrap ||
                  (sw.resolved && child.package._resolved === sw.resolved) ||
                  (sw.from && url.parse(sw.from).protocol && child.package._from === sw.from) ||
                  child.package.version === sw.version)) {
      if (!child.fromShrinkwrap) child.fromShrinkwrap = spec
      tree.children.push(child)
      return next()
    }
    fetchPackageMetadata(spec, tree.path, iferr(next, function (pkg) {
      pkg._from = sw.from || spec
      addShrinkwrap(pkg, iferr(next, function () {
        addBundled(pkg, iferr(next, function () {
          var child = createChild({
            package: pkg,
            loaded: false,
            parent: tree,
            fromShrinkwrap: spec,
            path: path.join(tree.path, 'node_modules', pkg.name),
            realpath: path.resolve(tree.realpath, 'node_modules', pkg.name),
            children: pkg._bundled || []
          })
          tree.children.push(child)
          if (pkg._bundled) {
            inflateBundled(child, child.children)
          }
          $$recurse$$(child, sw.dependencies || {}, next)
        }))
      }))
    }))
  }, finishInflating)
})
