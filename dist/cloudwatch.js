"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _awsSdk = require("aws-sdk");

var _awsSdk2 = _interopRequireDefault(_awsSdk);

var _time = require("./time.js");

var _time2 = _interopRequireDefault(_time);

var _moment = require("moment");

var _moment2 = _interopRequireDefault(_moment);

var _metrics = require("./metrics.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var CloudWatch = function () {
  function CloudWatch() {
    _classCallCheck(this, CloudWatch);
  }

  _createClass(CloudWatch, [{
    key: "endTime",


    /** */
    value: function endTime(d) {
      this._endTime = d;
      return this;
    }

    /** */

  }, {
    key: "duration",
    value: function duration(d) {
      this._duration = d;
      return this;
    }

    /** */

  }, {
    key: "period",
    value: function period(p) {
      this._period = p;
      return this;
    }

    /** */

  }, {
    key: "statistics",
    value: function statistics(name) {
      this._statistics = name;
      return this;
    }

    /** */

  }, {
    key: "getDiskSpaceUtilDimensionMap",
    value: function getDiskSpaceUtilDimensionMap() {
      var _this = this;

      return new Promise(function (resolve, reject) {
        if (_this._diskSpaceUtilMetricsMap) {
          resolve(_this._diskSpaceUtilMetricsMap);
          return;
        }

        var cloudwatch = new _awsSdk2.default.CloudWatch();
        var params = {
          Namespace: 'System/Linux',
          MetricName: 'DiskSpaceUtilization'
        };
        cloudwatch.listMetrics(params, function (err, data) {
          if (err) {
            reject(err);return;
          }

          var map = {};
          data.Metrics.forEach(function (metric) {
            var obj = {};
            metric.Dimensions.forEach(function (dim) {
              obj[dim.Name] = dim.Value;
            });
            obj.origDimensions = metric.Dimensions;
            // {
            //   InstanceId: 'xxx',
            //   MountPath: 'yyy',
            //   Filesystem: 'zzz',
            //   origDimensions: [
            //     {Name: 'InstanceId', Value: 'xxx'},
            //     {Name: 'MountPath', Value: 'yyy'},
            //     {Name: 'Filesystem', Value: 'zzz'},
            //   ]
            // }
            map[obj.InstanceId] = obj;
          });

          _this._diskSpaceUtilMetricsMap = map;
          resolve(_this._diskSpaceUtilMetricsMap);
        });
      });
    }
  }, {
    key: "getDiskSpaceUtilExtraDims",
    value: function getDiskSpaceUtilExtraDims(instanceID) {
      return this.getDiskSpaceUtilDimensionMap().then(function (map) {
        return map[instanceID].origDimensions;
      });
    }

    /** */

  }, {
    key: "metricStatistics",
    value: function metricStatistics(namespace, instanceID, metricName) {
      var _this2 = this;

      var cloudwatch = new _awsSdk2.default.CloudWatch();
      var prms = Promise.resolve();

      var dimName = (0, _metrics.nsToDimName)(namespace);
      var metric = (0, _metrics.searchMetric)(namespace, metricName);
      var sep = _time2.default.toSEP(this._duration, this._endTime);
      if (this._period) {
        sep.Period = this._period;
      }
      if (this._statistics) {
        metric.Statistics = [this._statistics];
      }

      var dims = [{ Name: dimName, Value: instanceID }];
      if (namespace === 'System/Linux' && metricName === 'DiskSpaceUtilization') {
        prms = prms.then(function () {
          return _this2.getDiskSpaceUtilExtraDims(instanceID).then(function (dims_) {
            dims = dims_;
          });
        });
      }

      var params = {};
      prms = prms.then(function () {
        params = _extends({}, sep, metric, {
          Namespace: namespace,
          Dimensions: dims
        });
      });

      //process.stderr.write(JSON.stringify(params));

      prms = prms.then(function () {
        return new Promise(function (resolve, reject) {
          return cloudwatch.getMetricStatistics(params, function (err, data) {
            return err ? reject(err) : resolve([sep, data]);
          });
        });
      });
      return prms;
    }
  }]);

  return CloudWatch;
}();

exports.default = CloudWatch;