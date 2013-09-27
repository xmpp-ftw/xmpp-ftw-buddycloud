var builder    = require('ltx'),
    PubSub     = require('xmpp-ftw-pubsub'),
    Presence   = require('xmpp-ftw/lib/presence'),
    Disco      = require('xmpp-ftw-disco'),
    Register   = require('xmpp-ftw-register'),
    Search     = require('xmpp-ftw-search'),
    async      = require('async'),
    rsm        = require('xmpp-ftw/lib/utils/xep-0059'),
    itemParser = require('xmpp-ftw-item-parser')

var Buddycloud = function() {
    this.itemParser
    this.channelServer
    this.disco = new Disco()
    this.presence = new Presence()
    this.register = new Register()
    this.search = new Search()
    
    this.discoveryTimeout = this.DISCO_RESPONSE_TIMEOUT
    this.maxRecentItemsPerChannel = 30
}

Buddycloud.prototype.__proto__ = PubSub.prototype

var init = Buddycloud.prototype.init

Buddycloud.prototype.init = function(manager) {
    init.call(this, manager)
    this.disco.init(manager, true)
    this.presence.init(manager, true)
    this.register.init(manager, true)
    this.search.init(manager, true)
}

Buddycloud.prototype.NS_BUDDYCLOUD = 'http://buddycloud.org/v1'
Buddycloud.prototype.DISCO_RESPONSE_TIMEOUT = 8000

Buddycloud.prototype.setDiscoveryTimeout = function(timeout) {
    this.discoveryTimeout = timeout
    return this
}

Buddycloud.prototype._events = {
    'xmpp.buddycloud.discover': 'discover',
    'xmpp.buddycloud.register': 'setRegister',
    'xmpp.buddycloud.presence': 'setPresence',
    'xmpp.buddycloud.create': 'createNewNode',
    'xmpp.buddycloud.publish': 'publishItem',
    'xmpp.buddycloud.retrieve': 'retrieve',
    'xmpp.buddycloud.items.recent': 'recentItems',
    'xmpp.buddycloud.items.replies': 'getReplies',
    'xmpp.buddycloud.items.thread': 'getThread',
    'xmpp.buddycloud.item.delete': 'deleteNodeItem',
    'xmpp.buddycloud.subscribe': 'nodeSubscribe',
    'xmpp.buddycloud.unsubscribe': 'nodeUnsubscribe',
    'xmpp.buddycloud.subscription': 'setNodeSubscription',
    'xmpp.buddycloud.config.set': 'setConfiguration',
    'xmpp.buddycloud.config.get': 'getConfiguration',
    'xmpp.buddycloud.subscriptions': 'getNodeSubscriptions',
    'xmpp.buddycloud.affiliations': 'getNodeAffiliations',
    'xmpp.buddycloud.affiliation': 'setNodeAffiliation',
    'xmpp.buddycloud.discover.items': 'discoverItems',
    'xmpp.buddycloud.discover.info': 'discoverFeatures',
    'xmpp.buddycloud.search.get': 'searchGet',
    'xmpp.buddycloud.search.do': 'performSearch',
    'xmpp.buddycloud.register.get': 'getRegister',
    'xmpp.buddycloud.register.set': 'setRegister',
    'xmpp.buddycloud.register.password': 'changePassword',
    'xmpp.buddycloud.register.unregister': 'unregister'
    
}

Buddycloud.prototype.setPresence = function() {
    if (!this._checkCall({}, null, true)) return
    this.presence.sendPresence({
        to: this.channelServer,
        priority: -1,
        status: 'buddycloud',
        show: 'online'
    })
}

Buddycloud.prototype.createNewNode = function(data, callback) {
    if (!this._checkCall(data, callback)) return
    this.createNode(data, callback)
}

Buddycloud.prototype.publishItem = function(data, callback) {
   if (!this._checkCall(data, callback)) return
    this.publish(data, callback)
}

Buddycloud.prototype.retrieve = function(data, callback) {
   if (!this._checkCall(data, callback)) return
    var done = function(error, items, rsm) {
        if (error) return callback(error)
        for (var i = 0; i < items.length; i++)
            items[i].node = data.node
        callback(error, items, rsm)
    }
    this.getItems(data, done)
}

Buddycloud.prototype.recentItems = function(data, callback) {
    if (!this._checkCall(data, callback)) return
    this.getRecentItems(data, callback)
}

Buddycloud.prototype.getReplies = function(data, callback) {
    if (!this._checkCall(data, callback)) return
    this.getItemSet(data, callback, 'replies')
}

Buddycloud.prototype.getThread = function(data, callback) {
    if (!this._checkCall(data, callback)) return
    this.getItemSet(data, callback, 'thread')
}

Buddycloud.prototype.deleteNodeItem = function(data, callback) {
    if (!this._checkCall(data, callback)) return
    this.deleteItem(data, callback)
}

Buddycloud.prototype.nodeSubscribe = function(data, callback) {
    if (!this._checkCall(data, callback)) return
    delete(data.jid)
    this.subscribe(data, callback)
}

Buddycloud.prototype.nodeUnsubscribe = function(data, callback) {
    if (!this._checkCall(data, callback)) return
    delete(data.jid)
    this.unsubscribe(data, callback)
}

Buddycloud.prototype.setNodeSubscription = function(data, callback) {
    if (!this._checkCall(data, callback)) return
    this.setSubscription(data, callback)
}

Buddycloud.prototype.setConfiguration = function(data, callback) {
    if (!this._checkCall(data, callback)) return
    this.setNodeConfiguration(data, callback)
}

Buddycloud.prototype.getConfiguration = function(data, callback) {
    if (!this._checkCall(data, callback)) return
    if (data.owner) return this.getNodeConfiguration(data, callback)
    this.getNodeInformation(data, callback)
}

Buddycloud.prototype.getNodeSubscriptions = function(data, callback) {
    if (!this._checkCall(data, callback)) return
    this.getSubscriptions(data, callback)
}

Buddycloud.prototype.getNodeAffiliations = function(data, callback) {
    if (!this._checkCall(data, callback)) return
    this.getAffiliations(data, callback)
}

Buddycloud.prototype.setNodeAffiliation = function(data, callback) {
    if (!this._checkCall(data, callback)) return
    this.setAffiliation(data, callback)
}

Buddycloud.prototype.discoverItems = function(data, callback) {
    this.disco.getItems(data, callback)
}

Buddycloud.prototype.discoverFeatures = function(data, callback) {
    this.disco.getFeatures(data, callback)
}

Buddycloud.prototype.searchGet = function(data, callback) {
    if (!this._checkCall(data, callback)) return
    this.search.getSearchFields(data, callback)
}

Buddycloud.prototype.performSearch = function(data, callback) {
    var self = this
    if (!this._checkCall(data, callback)) return
    this.search.performSearch(data, function(error, data) {
        if (error) return callback(error)
        var counter = 0
        data.results.forEach(function(result) {
            data.results[counter].entry = self._getItemParser()
                .parse(builder.parse('<item>' + result.entry + '</item>'))
            ++counter
        })
        callback(null, data)
    })
}

Buddycloud.prototype.handles = function(stanza) {
    if (!this.channelServer || (stanza.attrs.from != this.channelServer))
        return false
    return PubSub.prototype.handles(stanza)
}

Buddycloud.prototype.handle = function(stanza) {
    if (!!stanza.getChild('event', this.NS_EVENT))
        return this._eventNotification(stanza)
    return this._handleSubscriptionAuthorisation(stanza)
}

Buddycloud.prototype._getItemParser = function() {
    if (!this.itemParser) {
        this.itemParser = itemParser
        this.itemParser.setLogger(this.manager._getLogger())
    }
    return this.itemParser
}

Buddycloud.prototype.setItemParser = function(parser) {
    this.itemParser = parser
    return this
}

Buddycloud.prototype._checkCall = function(data, callback, skipCallback) {
    if (!data) return this._clientError('Missing payload', data, callback)
    if (!skipCallback && (typeof callback !== 'function')) {
        this._clientError('Missing callback', data)
        return false
    }
    if (!this.channelServer) {
        this._clientError(
            'You must perform discovery first!', data, callback
        )
        return false
    }
    data.to = this.channelServer
    return true
}

Buddycloud.prototype.discover = function(data, callback) {
    var self = this
    if (typeof callback !== 'function')
        return this._clientError('Missing callback', data)
    if (data && data.server) {
        this.channelServer = data.server
        return callback(null, data.server)
    }
    var request = { of: this.manager.jid.split('@')[1] }
    this.disco.getItems(request, function(error, items) {
        if (error) return callback(error)
        var jobs = {}
        items.forEach(function(item) {
            jobs[item.jid] = function(infoCallback) {
                var callbackMade = false
                var timeout = setTimeout(function() {
                    callbackMade = true
                    infoCallback(null, [])
                }, self.discoveryTimeout)
                var request = { of: item.jid }
                self.disco.getFeatures(request, function(error, features) {
                    clearTimeout(timeout)
                    if (error) features = []
                    if (false === callbackMade) {
                        callbackMade = true
                        infoCallback(null, features)
                    }
                })
            }
        })
        async.parallel(jobs, function(error, results) {
            var discovered = false
            if (error) return callback(error)
            for (var i in results) {
                results[i].forEach(function(feature) {
                    if (('identity' == feature.kind) &&
                        (feature.category && 'pubsub' == feature.category) &&
                        (feature.type && 'channels' == feature.type)) {
                        self.channelServer = i
                        discovered = true
                        return callback(null, i)
                    }
                })
            }
            if (false === discovered)
                return callback('No buddycloud server found')
        })
    })
}

Buddycloud.prototype._purgeNodeNotification = function(stanza, purge) {
    var data = { node: purge.attrs.node }
    this.socket.emit('xmpp.buddycloud.push.purge', data)
    return true
}

Buddycloud.prototype._itemDeleteNotification = function(stanza, items) {
    var data = {}
    this._getItemData(items, data, 'retract')
    this._getHeaderData(stanza, data)
    this.socket.emit('xmpp.buddycloud.push.retract', data)
    return true
}

Buddycloud.prototype._itemNotification = function(stanza, items) {
    var data = {}
    this._getItemData(items, data)
    if (stanza.getChild('headers'))
        this._getHeaderData(stanza, data)
    if (stanza.getChild('delay'))
        data.delay = stanza.getChild('delay').attrs.stamp
    this.socket.emit('xmpp.buddycloud.push.item', data)
    return true
}

Buddycloud.prototype._configurationUpdate = function(stanza, configuration) {
    var data = {}
    this._getConfigurationChanges(configuration, data)
    this.socket.emit('xmpp.buddycloud.push.configuration', data)
    return true
}

Buddycloud.prototype._deleteNodeNotification = function(stanza, del) {
    var data = {}
    this._getDeleteNodeNotification(del, data)
    this.socket.emit('xmpp.buddycloud.push.delete', data)
    return true
}

Buddycloud.prototype.getRecentItems = function(data, callback) {
    var self = this
    var max = (!data.max) ? this.maxRecentItemsPerChannel : data.max
    var since = (!data.since) ? 0 : data.since
    since = Date.parse(since)
    var stanza = this._getStanza({ to: data.to }, 'get', 'recent-items')
    if (true === isNaN(since))
        return this._clientError('Recent date was unparsable', data, callback)
    stanza.attrs = {
        xmlns: this.NS_BUDDYCLOUD,
        max: max,
        since: new Date(since).toISOString()
    }
    if (data.rsm) rsm.build(stanza.root().getChild('pubsub'), data.rsm)

    this.manager.trackId(stanza.root().attr('id'), function(stanza) {
        if ('error' == stanza.attrs.type)
            return callback(self._parseError(stanza))
        var recentItems = []
        stanza.getChild('pubsub').getChildren('items').forEach(function(items) {
            var node = items.attrs.node
            items.getChildren('item').forEach(function(item) {
                recentItems.push({
                    id: item.attrs.id,
                    node: node,
                    entry: self._getItemParser().parse(item)
                })
            })
        })
        callback(
            null,
            recentItems,
            rsm.parse(stanza.root().getChild('pubsub'))
        )
    })
    this.client.send(stanza)
}

Buddycloud.prototype.getItemSet = function(data, callback, type) {
    if (!data.node)
        return this._clientError('Missing \'node\' key', data, callback)
    if (!data.id)
        return this._clientError("Missing 'id' key", data, callback)
    var self = this
    var stanza = this._getStanza({ to: data.to }, 'get', type)
    stanza.attrs = {
        xmlns: this.NS_BUDDYCLOUD,
        node: data.node,
        'item_id': data.id
    }
    if (data.rsm) rsm.build(stanza.root().getChild('pubsub'), data.rsm)
    this.manager.trackId(stanza.root().attr('id'), function(stanza) {
        if ('error' == stanza.attrs.type)
            return callback(self._parseError(stanza))
        var replies = []
        var items = stanza.getChild('pubsub')
            .getChild('items')
            .getChildren('item')
        items.forEach(function(item) {
            replies.push({
                id: item.attrs.id,
                entry: self._getItemParser().parse(item),
                node: data.node
            })
        })
        callback(
            null,
            replies,
            rsm.parse(stanza.root().getChild('pubsub'))
        )
    })
    this.client.send(stanza)
}

Buddycloud.prototype.getNodeInformation = function(data, callback) {
    var self = this
    if (!data.node)
        return this._clientError('Missing \'node\' key', data, callback)
    var request = { of: data.to, node: data.node }
    this.disco.getFeatures(request, function(error, features) {
        if (error) return callback(error)
        var done = false
        features.some(function(feature) {
            if ('form' == feature.kind) {
                done = true
                return callback(null, feature.form.fields)
            }
        })
        if (false === done)
            self._clientError('No node information found', data, callback)
    })
}

Buddycloud.prototype._handleSubscriptionAuthorisation = function(stanza) {
    var data = { id: stanza.attrs.id }
    this._handleAuthorisationRequest(
        data,
        stanza,
        'xmpp.buddycloud.push.authorisation'
    )
}

Buddycloud.prototype._affiliationUpdate = function(stanza, affiliations) {
    var data = {}
    this._getAffiliationUpdate(affiliations, data)
    this.socket.emit('xmpp.buddycloud.push.affiliation', data)
    return true
}

Buddycloud.prototype._subscriptionUpdate = function(stanza, subscription) {
    var data = {}
    this._getSubscriptionUpdate(subscription, data)
    this.socket.emit('xmpp.buddycloud.push.subscription', data)
    return true
}


Buddycloud.prototype.setRegister = function(data, callback) {
    if (!this._checkCall(data, callback)) return
    this.register.set(data, callback)
}

Buddycloud.prototype.getRegister = function(data, callback) {
    if (!this._checkCall(data, callback)) return
    this.register.get(data, callback)
}

Buddycloud.prototype.changePassword = function(data, callback) {
    if (!this._checkCall(data, callback)) return
    this.register.changePassword(data, callback)
}

Buddycloud.prototype.unregister = function(data, callback) {
    if (!this._checkCall(data, callback)) return
    this.register.unreigster(data, callback)
}

module.exports = Buddycloud