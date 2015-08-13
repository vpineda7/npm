'use strict'
var validate = require('aproba')
var stream = require('stream')

var runNext = global.setImmediate || process.nextTick

function tooManyIterations (who, max) {
  var er = new Error('While statement looped more than maximum iteration count of ' + max)
  er.code = 'ETOOMANYITERATIONS'
  Error.captureStackTrace(er, who)
  return er
}

exports.while = function (maxIterations, condition, each, done) {
  validate('NFFF', arguments)
  var iter = 0
  function oneIteration (er) {
    if (er) return done(er)
    condition(function (doMore) {
      if (!doMore) return done()
      if (++iter > maxIterations) {
        return done(tooManyIterations(exports.while, maxIterations))
      }
      var next = dezalgo(oneIteration)
      next.stop = function () {
        return done()
      }
      each(next)
    })
  }
  oneIteration()
}

var syncStop = function () {
  var er = new Error()
  er.code = 'BREAK'
  throw er
}

exports.whileSync = function (maxIterations, condition, each) {
  validate('NFF', arguments)
  var iter = 0
  while (condition()) {
    if (++iter > maxIterations) {
      throw tooManyIterations(exports.whileSync, maxIterations)
    }
    try {
      each(syncStop)
    } catch (ex) {
      if (ex.code === 'BREAK') return
      throw ex
    }
  }
}

exports.defer = function (cb) {
  validate('F', [cb])
  var args = Array.prototype.slice.call(arguments, 1)
  runNext(function () {
    cb.apply(null, args)
  })
}

// We have our own dezalgo because it's much simpler– it
// doesn't maintain properties across callback (w/ wrappy)
// it doesn't use asap. It's just the core functionality.
var dezalgo = exports.dezalgo = function (cb) {
  validate('F', arguments)
  var runWithArgs
  var zalgoSafeCallback = function () {
    runWithArgs = arguments
  }
  runNext(function () {
    zalgoSafeCallback = cb
    if (runWithArgs) cb.apply(null, runWithArgs)
  })
  return function () {
    zalgoSafeCallback.apply(null, arguments)
  }
}

exports.onlyOnce = function (cb) {
  validate('F', arguments)
  var haveRun = false
  return dezalgo(function guard () {
    if (haveRun) {
      var er = new Error('Callback called more than once')
      er.code = 'EMORETHANONCE'
      Error.captureStackTrace(er, guard)
      throw er
    } else {
      haveRun = true
      cb.apply(null, arguments)
    }
  })
}

// Similarly we provide our own once. It doesn't do
// wrappy stuff, but it does ensure zalgo is contained.
exports.once = function (cb) {
  validate('F', arguments)
  var haveRun = false
  return dezalgo(function () {
    if (!haveRun) {
      haveRun = true
      cb.apply(null, arguments)
    }
  })
}

exports.recurseLimit = function (maxDepth, maxCalls, func) {
  var er = new Error()
  return function recurse () {
    var args = Array.prototype.slice.call(arguments)
    var cb = args.pop()
    var depth = 0
    var calls = [0]
    if (typeof cb !== 'function') {
      calls = cb
      depth = args.pop()
      cb = args.pop()
    }
    function $$recurse$$ () {
      var args = Array.prototype.slice.call(arguments)
      args.push(depth + 1, calls)
      return recurse.apply(null, args)
    }
    args.push($$recurse$$, cb)
    var ex
    if (depth >= maxDepth) {
      ex = new Error('Exceeded maximum recurse depth: ' + depth + ' >= ' + maxDepth + ' (calls: ' + calls[0] + ')')
      ex.code = 'ERECURSETOODEEP'
      ex.stack = er.stack
      throw ex
    }
    if (++calls[0] >= maxCalls) {
      ex = new Error('Exceeded maximum recurse iterations: ' + calls[0] + ' >= ' + maxCalls + ' (depth: ' + depth + ') ')
      ex.code = 'ERECURSETOOMANY'
      ex.stack = er.stack
      throw ex
    }
    return func.apply(null, args)
  }
}

exports.recurseLimitSync = function (maxDepth, maxCalls, func) {
  return function recurse () {
    var args = Array.prototype.slice.call(arguments)
    var depth = 0
    var calls = [0]
    if (args.length > func.length) {
      calls = args.pop()
      depth = args.pop()
    }
    function $$recurse$$ () {
      var args = Array.prototype.slice.call(arguments)
      args.push(depth + 1, calls)
      return recurse.apply(null, args)
    }
    args.push($$recurse$$)
    var ex
    if (depth >= maxDepth) {
      ex = new Error('Exceeded maximum recurse depth: ' + depth + ' >= ' + maxDepth + ' (calls: ' + calls[0] + ')')
      ex.code = 'ERECURSETOODEEP'
      throw ex
    }
    if (++calls[0] >= maxCalls) {
      ex = new Error('Exceeded maximum recurse iterations: ' + calls[0] + ' >= ' + maxCalls + ' (depth: ' + depth + ') ')
      ex.code = 'ERECURSETOOMANY'
      throw ex
    }
    return func.apply(null, args)
  }
}

var mangled = false
var mangleGlobalFs = exports.mangleGlobalFs = function () {
  if (mangled) return
  console.log('MANGLE')
  mangled = true
  ;[require('fs')].forEach(function (fs) {
    fs._mangled = true
    Object.keys(fs).forEach(function (name) {
      if (/Sync$/.test(name)) return // no sync functions
      if (/^_/.test(name)) return // no privates
      if (/^[A-Z]/.test(name)) return // no classes
      if (/^create.*Stream$/.test(name)) return // streams are separate
      if (/^gracefulify$/.test(name)) return // magic graceful-fs thingy
      var real = fs[name]
      fs[name] = function () {
//        console.log("CALLED", name, arguments)
        var args = Array.prototype.slice.call(arguments)
        var cb = args.pop()
        var src = new Error()
        args.push(function (er) {
          if (er) er.stack = src.stack
          cb.apply(null, arguments)
        })
        console.log("CALLING", name, args.slice(0,-1))
        return real.apply(fs, args)
      }
    })
    var createReadStream = fs.createReadStream
    fs.createReadStream = function () {
      console.log('\n\ncreateReadStream\n\n')
      var src = new Error()
      var rawStream = createReadStream.apply(fs, arguments)
      var patchedStream = rawStream.pipe(new stream.PassThrough())
      rawStream.on('error', function (er) {
        er.stack = src.stack
        patchedStream.emit('error', er)
      })
      rawStream.on('open', function () {
        var args = ['open'].concat(Array.prototype.slice.call(arguments))
        patchedStream.emit.apply(patchedStream, args)
      })
      return patchedStream
    }
    var createWriteStream = fs.createWriteStream
    fs.createWriteStream = function () {
      console.log('\n\ncreateWriteStream\n\n')
      var src = new Error()
      var patchedStream = new stream.PassThrough()
      var rawStream = patchedStream.pipe(createWriteStream.apply(fs, arguments))
      rawStream.on('error', function (er) {
        er.stack = src.stack
        patchedStream.emit('error', er)
      })
      var listeners = {error: true}
      rawStream.on('open', function () {
        var args = ['open'].concat(Array.prototype.slice.call(arguments))
        patchedStream.emit.apply(patchedStream, args)
      })
      return patchedStream
    }
  })
}
mangleGlobalFs()
console.log('mangle complete',require('graceful-fs')._mangled, require('fs')._mangled)
var createWriteStreamAtomic = require('fs-write-stream-atomic')
