import * as events from 'events';
import {
  FEATURE_IDENTIFIER_ATTRIBUTE,
  FEATURE_NAME_ATTRIBUTE,
  GLOBAL_TARGET,
  SDK_LANGUAGE,
  SDK_LANGUAGE_ATTRIBUTE,
  SDK_TYPE,
  SDK_TYPE_ATTRIBUTE,
  SDK_VERSION_ATTRIBUTE,
  TARGET_ATTRIBUTE,
  VARIATION_IDENTIFIER_ATTRIBUTE,
} from './constants';
import {
  Configuration,
  FeatureConfig,
  Metrics,
  MetricsApi,
  Variation,
  TargetData,
  KeyValue,
  MetricsData,
  MetricsDataMetricsTypeEnum,
} from './openapi';
import { Options, Target } from './types';
import { VERSION } from './version';
import {
  infoMetricsSuccess,
  infoMetricsThreadExited,
  warnPostMetricsFailed,
} from './sdk_codes';

export enum MetricEvent {
  READY = 'metrics_ready',
  ERROR = 'metrics_error',
}

interface AnalyticsEvent {
  target: Target;
  featureConfig: FeatureConfig;
  variation: Variation;
  count: number;
}

export interface MetricsProcessorInterface {
  start(): void;
  close(): void;
  enqueue(
    target: Target,
    featureConfig: FeatureConfig,
    variation: Variation,
  ): void;
}

export const MetricsProcessor = (
  environment: string,
  cluster = '1',
  conf: Configuration,
  options: Options,
  eventBus: events.EventEmitter,
  closed = false,
): MetricsProcessorInterface => {
  const data: Map<string, AnalyticsEvent> = new Map<string, AnalyticsEvent>();
  let syncInterval: NodeJS.Timeout;

  const configuration = new Configuration({
    ...conf,
    basePath: options.eventsUrl,
  });
  const api = new MetricsApi(configuration);
  const log = options.logger;

  const enqueue = (
    target: Target,
    featureConfig: FeatureConfig,
    variation: Variation,
  ): void => {
    const event: AnalyticsEvent = {
      target,
      featureConfig,
      variation,
      count: 0,
    };

    const key = _formatKey(event);
    const found = data.get(key);
    if (found) {
      found.count++;
    } else {
      event.count = 1;
      data.set(key, event);
    }
  };

  const _formatKey = (event: AnalyticsEvent): string => {
    const feature = event.featureConfig.feature;
    const variation = event.variation.identifier;
    const value = event.variation.value;
    const target = GLOBAL_TARGET;
    return `${feature}/${variation}/${value}/${target}`;
  };

  const _summarize = (): Metrics | unknown => {
    const targetData: TargetData[] = [];
    const metricsData: MetricsData[] = [];

    // clone map and clear data
    const clonedData = new Map(data);
    data.clear();

    for (const event of clonedData.values()) {
      if (event.target && !event.target.anonymous) {
        let targetAttributes: KeyValue[] = [];
        if (event.target.attributes) {
          targetAttributes = Object.entries(event.target.attributes).map(
            ([key, value]) => {
              const stringValue =
                value === null || value === undefined
                  ? ''
                  : valueToString(value);
              return { key, value: stringValue };
            },
          );
        }

        let targetName = event.target.identifier;
        if (event.target.name) {
          targetName = event.target.name;
        }

        const td: TargetData = {
          identifier: event.target.identifier,
          name: targetName,
          attributes: targetAttributes,
        };
        targetData.push(td);
      }

      const metricsAttributes: KeyValue[] = [
        {
          key: FEATURE_IDENTIFIER_ATTRIBUTE,
          value: event.featureConfig.feature,
        },
        {
          key: FEATURE_NAME_ATTRIBUTE,
          value: event.featureConfig.feature,
        },
        {
          key: VARIATION_IDENTIFIER_ATTRIBUTE,
          value: event.variation.identifier,
        },
        {
          key: SDK_TYPE_ATTRIBUTE,
          value: SDK_TYPE,
        },
        {
          key: SDK_LANGUAGE_ATTRIBUTE,
          value: SDK_LANGUAGE,
        },
        {
          key: SDK_VERSION_ATTRIBUTE,
          value: VERSION,
        },
        {
          key: TARGET_ATTRIBUTE,
          value: event?.target?.identifier ?? null,
        },
      ];

      // private target attributes
      // need more info

      const md: MetricsData = {
        timestamp: Date.now(),
        count: event.count,
        metricsType: MetricsDataMetricsTypeEnum.Ffmetrics,
        attributes: metricsAttributes,
      };
      metricsData.push(md);
    }
    return {
      targetData: targetData,
      metricsData: metricsData,
    };
  };

  const _send = (): void => {
    if (closed) {
      log.debug('SDK has been closed before metrics can be sent');
      return;
    }

    if (data.size == 0) {
      log.debug('No metrics to send in this interval');
      return;
    }

    const metrics: Metrics = _summarize();

    log.debug('Start sending metrics data');
    api
      .postMetrics(environment, cluster, metrics)
      .then((response) => {
        log.debug('Metrics server returns: ', response.status);
        infoMetricsSuccess(log);
        if (response.status >= 400) {
          log.error(
            'Error while sending metrics data with status code: ',
            response.status,
          );
        }
      })
      .catch((error: Error) => {
        warnPostMetricsFailed(`${error}`, log);
        log.debug('Metrics server returns error: ', error);
      });
  };

  const start = (): void => {
    log.info(
      'Starting MetricsProcessor with request interval: ',
      options.eventsSyncInterval,
    );
    syncInterval = setInterval(_send, options.eventsSyncInterval);
    eventBus.emit(MetricEvent.READY);
  };

  const valueToString = (value: any): string => {
    switch (typeof value) {
      case 'string':
        return value;
      case 'number':
      case 'boolean':
      case 'bigint':
      case 'symbol':
        return value.toString();
      case 'object':
        if (Array.isArray(value)) {
          return value.toString()
        }
        return value === null ? '' : JSON.stringify(value);
      default:
        return '';
    }
  };

  const close = (): void => {
    log.info('Closing MetricsProcessor');
    clearInterval(syncInterval);
    _send();
    closed = true;
    log.info('MetricsProcessor closed');
    infoMetricsThreadExited(log);
  };

  return {
    start,
    close,
    enqueue,
  };
};
