var _keys = require('babel-runtime/core-js/object/keys');

var _keys2 = _interopRequireDefault(_keys);

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _defineProperty2 = require('babel-runtime/helpers/defineProperty');

var _defineProperty3 = _interopRequireDefault(_defineProperty2);

var _assign = require('babel-runtime/core-js/object/assign');

var _assign2 = _interopRequireDefault(_assign);

var _stringify = require('babel-runtime/core-js/json/stringify');

var _stringify2 = _interopRequireDefault(_stringify);

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : { default: obj };
}

var Sequelize = require('sequelize');

function capitalize(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function toArray(value) {
  return Array.isArray(value) ? value : [value];
}

function clone(value) {
  return JSON.parse((0, _stringify2.default)(value));
}

function cloneAttrs(model, attrs, excludeAttrs) {
  var clone = {};
  var attributes = model.rawAttributes || model.attributes;
  for (var p in attributes) {
    if (excludeAttrs.indexOf(p) > -1) continue;
    var nestedClone = {};
    var attribute = attributes[p];
    for (var np in attribute) {
      if (attrs.indexOf(np) > -1) {
        nestedClone[np] = attribute[np];
      }
    }
    clone[p] = nestedClone;
  }
  return clone;
}

var VersionType = {
  CREATED: 1,
  UPDATED: 2,
  DELETED: 3,
};

var Hook = {
  AFTER_CREATE: 'afterCreate',
  AFTER_UPDATE: 'afterUpdate',
  AFTER_DESTROY: 'afterDestroy',
  AFTER_SAVE: 'afterSave',
  AFTER_BULK_CREATE: 'afterBulkCreate',
};

var defaults = {
  prefix: 'version',
  attributePrefix: '',
  suffix: '',
  schema: '',
  namespace: null,
  sequelize: null,
  exclude: [],
  tableUnderscored: true,
  underscored: true,
  versionAttributes: null,
};

function isEmpty(string) {
  return [undefined, null, NaN, ''].indexOf(string) > -1;
}

var hooks = [
  Hook.AFTER_CREATE,
  Hook.AFTER_UPDATE,
  Hook.AFTER_BULK_CREATE,
  Hook.AFTER_DESTROY,
];

var attrsToClone = ['type', 'field', 'get', 'set'];

function getVersionType(hook) {
  switch (hook) {
  case Hook.AFTER_CREATE:
  case Hook.AFTER_BULK_CREATE:
    return VersionType.CREATED;
  case Hook.AFTER_UPDATE:
    return VersionType.UPDATED;
  case Hook.AFTER_DESTROY:
    return VersionType.DELETED;
  }
  throw new Error('Version type not found for hook ' + hook);
}

function Version(model, customOptions) {
  var _versionAttrs,
    _this = this;

  var options = (0, _assign2.default)(
    {},
    defaults,
    Version.defaults,
    customOptions
  );

  var prefix = options.prefix,
    suffix = options.suffix,
    namespace = options.namespace,
    exclude = options.exclude,
    tableUnderscored = options.tableUnderscored,
    underscored = options.underscored,
    stampObsolete = options.stampObsolete;

  if (isEmpty(prefix) && isEmpty(suffix)) {
    throw new Error('Prefix or suffix must be informed in options.');
  }

  var sequelize = options.sequelize || model.sequelize;
  var schema = options.schema || model.options.schema;
  var attributePrefix = options.attributePrefix || options.prefix;
  var tableName =
    '' +
    (prefix ? '' + prefix + (tableUnderscored ? '_' : '') : '') +
    (model.options.tableName || model.name) +
    (suffix ? '' + (tableUnderscored ? '_' : '') + suffix : '');
  var versionFieldType =
    '' + attributePrefix + (underscored ? '_t' : 'T') + 'ype';
  var versionFieldId = '' + attributePrefix + (underscored ? '_i' : 'I') + 'd';
  var versionFieldTimestamp =
    '' + attributePrefix + (underscored ? '_t' : 'T') + 'imestamp';
  var versionFieldObsoleted =
    '' + attributePrefix + (underscored ? '_o' : 'O') + 'bsoleted';
  var versionModelName = '' + capitalize(prefix) + capitalize(model.name);

  var versionAttrs =
    ((_versionAttrs = {}),
    (0, _defineProperty3.default)(_versionAttrs, versionFieldId, {
      type: Sequelize.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    }),
    (0, _defineProperty3.default)(_versionAttrs, versionFieldType, {
      type: Sequelize.INTEGER,
      allowNull: false,
    }),
    (0, _defineProperty3.default)(_versionAttrs, versionFieldTimestamp, {
      type: Sequelize.DATE,
      allowNull: false,
    }),
    _versionAttrs);
  if (stampObsolete) {
    versionAttrs[versionFieldObsoleted] = {
      type: Sequelize.DATE,
      allowNull: true,
    };
  }

  var cloneModelAttrs = cloneAttrs(model, attrsToClone, exclude);
  var versionModelAttrs = (0, _assign2.default)(
    {},
    cloneModelAttrs,
    versionAttrs
  );

  var versionModelOptions = {
    schema,
    tableName,
    timestamps: false,
  };

  var versionModel = sequelize.define(
    versionModelName,
    versionModelAttrs,
    versionModelOptions
  );

  hooks.forEach(function(hook) {
    model.addHook(
      hook,
      (function() {
        var _ref = (0, _asyncToGenerator3.default)(
          /*#__PURE__*/ _regenerator2.default.mark(function _callee(
            instanceData,
            _ref2
          ) {
            var transaction = _ref2.transaction;
            var cls,
              versionTransaction,
              versionType,
              instancesData,
              versionTimestampValue,
              versionData,
              updateValues,
              thisVersionData,
              where,
              queryOptions;
            return _regenerator2.default.wrap(
              function _callee$(_context) {
                while (1) {
                  switch ((_context.prev = _context.next)) {
                  case 0:
                    cls = namespace || Sequelize.cls;
                    versionTransaction = void 0;

                    if (sequelize === model.sequelize) {
                      versionTransaction = cls
                        ? cls.get('transaction') || transaction
                        : transaction;
                    } else {
                      versionTransaction = cls
                        ? cls.get('transaction')
                        : undefined;
                    }

                    versionType = getVersionType(hook);
                    instancesData = toArray(instanceData);
                    versionTimestampValue = new Date();
                    versionData = instancesData.map(function(data) {
                      var _Object$assign2;

                      return (0,
                      _assign2.default)({}, clone(data), ((_Object$assign2 = {}), (0, _defineProperty3.default)(_Object$assign2, versionFieldType, versionType), (0, _defineProperty3.default)(_Object$assign2, versionFieldTimestamp, versionTimestampValue), _Object$assign2));
                    });

                    if (
                      !(stampObsolete && versionType !== VersionType.CREATED)
                    ) {
                      _context.next = 16;
                      break;
                    }

                    updateValues = {};

                    updateValues[
                      versionFieldObsoleted
                    ] = versionTimestampValue;
                    thisVersionData = instanceData;
                    where = model.primaryKeyAttributes.reduce(function(
                      cur,
                      keyName
                    ) {
                      var value = thisVersionData[keyName];
                      cur[keyName] = value;
                      return cur;
                    },
                    {});

                    where[versionFieldObsoleted] = null;
                    queryOptions = {
                      where,
                      limit: 1,
                      transaction: versionTransaction,
                      fields: [versionFieldObsoleted],
                      type: Sequelize.QueryTypes.UPDATE,
                    };
                    _context.next = 16;
                    return versionModel.update(updateValues, queryOptions);

                  case 16:
                    return _context.abrupt(
                      'return',
                      versionModel.bulkCreate(versionData, {
                        transaction: versionTransaction,
                      })
                    );

                  case 17:
                  case 'end':
                    return _context.stop();
                  }
                }
              },
              _callee,
              _this
            );
          })
        );

        return function(_x, _x2) {
          return _ref.apply(this, arguments);
        };
      })()
    );
  });

  versionModel.addScope('created', {
    where: (0, _defineProperty3.default)(
      {},
      versionFieldType,
      VersionType.CREATED
    ),
  });

  versionModel.addScope('updated', {
    where: (0, _defineProperty3.default)(
      {},
      versionFieldType,
      VersionType.UPDATED
    ),
  });

  versionModel.addScope('deleted', {
    where: (0, _defineProperty3.default)(
      {},
      versionFieldType,
      VersionType.DELETED
    ),
  });

  function getVersions(params) {
    var _this2 = this;

    var versionParams = {};
    var modelAttributes = model.rawAttributes || model.attributes;
    var primaryKeys = (0, _keys2.default)(modelAttributes).filter(function(
      attr
    ) {
      return modelAttributes[attr].primaryKey;
    });

    if (primaryKeys.length) {
      versionParams.where = primaryKeys
        .map(function(attr) {
          return (0, _defineProperty3.default)({}, attr, _this2[attr]);
        })
        .reduce(function(a, b) {
          return (0, _assign2.default)({}, a, b);
        });
    }

    if (params) {
      if (params.where)
        versionParams.where = (0, _assign2.default)(
          {},
          params.where,
          versionParams.where
        );
      versionParams = (0, _assign2.default)({}, params, versionParams);
    }

    return versionModel.findAll(versionParams);
  }

  // Sequelize V4 and above
  if (model.prototype) {
    if (!model.prototype.hasOwnProperty('getVersions')) {
      model.prototype.getVersions = getVersions;
    }

    //Sequelize V3 and below
  } else {
    var hooksForBind = hooks.concat([Hook.AFTER_SAVE]);

    hooksForBind.forEach(function(hook) {
      model.addHook(hook, function(instance) {
        var instances = toArray(instance);
        instances.forEach(function(i) {
          if (!i.getVersions) i.getVersions = getVersions;
        });
      });
    });
  }

  if (!model.getVersions) {
    model.getVersions = function(params) {
      return versionModel.findAll(params);
    };
  }

  return versionModel;
}

Version.defaults = (0, _assign2.default)({}, defaults);
Version.VersionType = VersionType;

module.exports = Version;
