// @flow
import AWS from "aws-sdk"
import time from "./time.js"
import moment from "moment"
import {
  nsToDimName,
  searchMetric,
} from "./metrics.js"

class CloudWatch {
  _endTime: string;
  _duration: string;
  _period: number;
  _statistics: string;
  _diskSpaceUtilMetricsMap: Object;

  /** */
  endTime(d: string): CloudWatch {
    this._endTime = d;
    return this;
  }

  /** */
  duration(d: string): CloudWatch {
    this._duration = d;
    return this;
  }

  /** */
  period(p: number): CloudWatch {
    this._period = p;
    return this;
  }

  /** */
  statistics(name: string): CloudWatch {
    this._statistics = name;
    return this;
  }

  /** */
  getDiskSpaceUtilDimensionMap(): Promise {
    return new Promise((resolve, reject) => {
      if (this._diskSpaceUtilMetricsMap) {
        resolve(this._diskSpaceUtilMetricsMap)
        return;
      }

      let cloudwatch = new AWS.CloudWatch();
      let params = {
        Namespace: 'System/Linux',
        MetricName: 'DiskSpaceUtilization',
      }
      cloudwatch.listMetrics(params, (err, data) => {
        if (err) { reject(err); return; }

        let map = {}
        data.Metrics.forEach(metric => {
          let obj = {}
          metric.Dimensions.forEach(dim => {
            obj[dim.Name] = dim.Value
          })
          obj.origDimensions = metric.Dimensions
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
          map[obj.InstanceId] = obj
        })

        this._diskSpaceUtilMetricsMap = map
        resolve(this._diskSpaceUtilMetricsMap)
      });
    })
  }

  getDiskSpaceUtilExtraDims(instanceID: string): Promise {
    return this.getDiskSpaceUtilDimensionMap().then(map => {
      return map[instanceID].origDimensions
    })
  }

  /** */
  metricStatistics(namespace: string, instanceID: string, metricName: string): Promise {
    let cloudwatch = new AWS.CloudWatch();
    let prms = Promise.resolve();

    let dimName = nsToDimName(namespace);
    let metric  = searchMetric(namespace, metricName);
    let sep     = time.toSEP(this._duration, this._endTime);
    if (this._period) {
      sep.Period = this._period;
    }
    if (this._statistics) {
      metric.Statistics = [ this._statistics ]
    }

    let dims = [
      { Name: dimName, Value: instanceID },
    ]
    if (
      namespace === 'System/Linux' &&
      metricName === 'DiskSpaceUtilization'
    ) {
      prms = prms.then(() => {
        return this.getDiskSpaceUtilExtraDims(instanceID)
          .then(dims_ => {
            dims = dims_
          })
      })
    }

    let params = {}
    prms = prms.then(() => {
      params = {
        ...sep,
        ...metric,
        Namespace: namespace,
        Dimensions: dims,
      };
    })

    //process.stderr.write(JSON.stringify(params));

    prms = prms.then(() => {
      return new Promise((resolve, reject) =>
        cloudwatch.getMetricStatistics(
          params,
          (err, data) => err ? reject(err) : resolve([sep, data])
        )
      )
    })
    return prms
  }
}

export default CloudWatch;

