'use strict';

var querystring = require('querystring').parse
  , url = require('url').parse;

//
// Used to fake middleware's
//
function noop() {}

/**
 * Transformer skeletons
 *
 * @constructor
 * @param {Primus} primus Reference to the primus.
 * @api public
 */
function Transformer(primus) {
  this.Spark = primus.Spark;
  this.primus = primus;
  this.service = null;

  this.initialise();
}

Transformer.prototype.__proto__ = require('events').EventEmitter.prototype;

//
// Simple logger shortcut.
//
Object.defineProperty(Transformer.prototype, 'logger', {
  get: function logger() {
    return {
      error: this.log.bind(this.primus, 'log', 'error'),  // Log error <line>.
      warn:  this.log.bind(this.primus, 'log', 'warn'),   // Log warn <line>.
      info:  this.log.bind(this.primus, 'log', 'info'),   // Log info <line>.
      debug: this.log.bind(this.primus, 'log', 'debug'),  // Log debug <line>.
      plain: this.log.bind(this.primus, 'log')            // Log x <line>.
    };
  }
});

/**
 * Simple log handler that will emit log messages under the given `type`.
 *
 * @api private
 */
Transformer.prototype.log = function log(type) {
  this.emit.apply(this, arguments);
};

/**
 * Create the server and attach the apropriate event listeners.
 *
 * @api private
 */
Transformer.prototype.initialise = function initialise() {
  if (this.server) this.server();

  var server = this.primus.server;

  server.listeners('request').map(this.on.bind(this, 'previous::request'));
  server.listeners('upgrade').map(this.on.bind(this, 'previous::upgrade'));

  //
  // Remove the old listeners as we want to be the first request handler for all
  // events.
  //
  server.removeAllListeners('request');
  server.removeAllListeners('upgrade');

  //
  // Start listening for incoming requests if we have a listener assigned to us.
  //
  if (this.listeners('request').length || this.listeners('previous::request').length) {
    server.on('request', this.request.bind(this));
  }

  if (this.listeners('upgrade').length || this.listeners('previous::upgrade').length) {
    server.on('upgrade', this.upgrade.bind(this));
  }
};

/**
 * Start listening for incoming requests and check if we need to forward them to
 * the transformers.
 *
 * @param {Request} req HTTP request.
 * @param {Response} res HTTP response.
 * @api private
 */
Transformer.prototype.request = function request(req, res) {
  if (!this.test(req)) return this.emit('previous::request', req, res);

  this.emit('request', req, res, noop);
};

/**
 * Starting listening for incoming upgrade requests and check if we need to
 * forward them to the transformers.
 *
 * @param {Request} req HTTP request.
 * @param {Socket} socket Socket.
 * @param {Buffer} head Buffered data.
 * @api private
 */
Transformer.prototype.upgrade = function upgrade(req, socket, head) {
  //
  // Copy buffer to prevent large buffer retention in Node core.
  // @see jmatthewsr-ms/node-slab-memory-issues
  //
  var buffy = new Buffer(head.length);
  head.copy(upgrade);

  if (!this.test(req)) return this.emit('previous::upgrade', req, socket, buffy);
  this.emit('upgrade', req, socket, buffy, noop);
};

/**
 * Check if we should accept this request.
 *
 * @param {Request} req HTTP Request.
 * @returns {Boolean} Do we need to accept this request.
 * @api private
 */
Transformer.prototype.test = function test(req) {
  req.uri = url(req.url);

  var route = this.primus.pathname
    , accepted = req.uri.pathname.slice(0, route.length) === route;

  if (!accepted) this.emit('unknown', req);

  //
  // Make sure that the first part of the path matches.
  //
  return accepted;
};

//
// Make the transporter extendable.
//
Transformer.extend = require('extendable');

//
// Expose the transformer's skeleton.
//
module.exports = Transformer;
