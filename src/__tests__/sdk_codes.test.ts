import { ConsoleLog, Logger } from "../log";
import * as sdkCodes from '../sdk_codes';

describe('SDK Tests', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new ConsoleLog()
  });

  test('Run all sdk_code functions without raising exceptions', () => {
    expect(() => {
      sdkCodes.infoSDKInitOK(logger);
      sdkCodes.infoSDKCloseSuccess(logger);
      sdkCodes.infoMetricsThreadStarted(5000, logger);
      sdkCodes.infoPollStarted(60, logger)
      sdkCodes.infoSDKInitWaiting( logger)
      sdkCodes.infoSDKStartClose( logger)
      sdkCodes.infoSDKAuthOK( logger)
      sdkCodes.infoPollingStopped("Dummy reason", logger)
      sdkCodes.infoStreamConnected( logger)
      sdkCodes.infoStreamEventReceived( "Dummy event", logger)
      sdkCodes.infoStreamStopped( logger)
      sdkCodes.infoMetricsSuccess( logger)
      sdkCodes.infoMetricsTargetExceeded( logger)
      sdkCodes.infoMetricsThreadExited( logger)
      sdkCodes.infoEvalSuccess( logger)
      sdkCodes.warnAuthFailedSrvDefaults( logger)
      sdkCodes.warnMissingSDKKey( logger)
      sdkCodes.warnFailedInitAuthError( logger)
      sdkCodes.warnAuthFailedExceedRetries( logger)
      sdkCodes.warnAuthRetrying(1, "dummy error", logger)
      sdkCodes.warnStreamDisconnected("dummy reason", logger)
      sdkCodes.warnStreamRetrying(4, logger)
      sdkCodes.warnPostMetricsFailed("dummy error", logger)
      sdkCodes.warnDefaultVariationServed("flag", "target", "default value", logger)
      // Call other functions here
    }).not.toThrow();
  });
});
