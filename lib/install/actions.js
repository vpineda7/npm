"use strict"
var assert = require("assert")
var path = require("path")
var chain = require("slide").chain
var asyncMap = require("slide").asyncMap
var finishLogAfterCb = require("./finish-log-after-cb.js")
var addParentToErrors = require("./add-parent-to-errors.js")
var uniqueFilename = require("../utils/get-name.js").uniqueFilename

var actions = {}

actions.fetch       = require("./action/fetch.js")
actions.extract     = require("./action/extract.js")
actions.build       = require("./action/build.js")
actions.test        = require("./action/test.js")
actions.preinstall  = require("./action/preinstall.js")
actions.install     = require("./action/install.js")
actions.postinstall = require("./action/postinstall.js")
actions.prepublish  = require("./action/prepublish.js")
actions.finalize    = require("./action/finalize.js")
actions.remove      = require("./action/remove.js")

Object.keys(actions).forEach(function (actionName){
  var action = actions[actionName]
  actions[actionName] = function (buildpath, pkg, log, cb) {
    return action(buildpath, pkg, log, addParentToErrors(pkg.parent, cb))
  }
})

function prepareAction (staging, log) {
  return function (action) {
    var cmd = action[0]
    var pkg = action[1]
    assert(actions[cmd])
    var buildpath = uniqueFilename(staging, pkg.package.name, pkg.realpath)
    return [actions[cmd], buildpath, pkg, log.newGroup(cmd+":"+pkg.package.name)]
  }
}

exports.actions = actions

exports.doSerial = function (type, staging, actionsToRun, log, cb) {
  actionsToRun = actionsToRun
    .filter(function (value) { return value[0]===type })
    .sort(function (aa, bb) { return aa[1].path.localeCompare(bb[1].path) })
  log.silly("doSerial", "%s %d", type, actionsToRun.length)
  chain(actionsToRun.map(prepareAction(staging, log)), finishLogAfterCb(log, cb))
}

exports.doParallel = function (type, staging, actionsToRun, log, cb) {
  actionsToRun = actionsToRun.filter(function (value) { return value[0]===type })
  log.silly("doParallel", type+" "+actionsToRun.length)

  asyncMap( actionsToRun.map(prepareAction(staging, log)), function (todo, next) {
    var cmd = todo.shift()
    todo.push(next)
    cmd.apply(null, todo)
  }, finishLogAfterCb(log, cb))
}