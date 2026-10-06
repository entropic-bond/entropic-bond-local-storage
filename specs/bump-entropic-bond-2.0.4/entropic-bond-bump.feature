Feature: Bump entropic-bond to the latest v2.x release
  As a maintainer of entropic-bond-local-storage
  I want the plugin pinned to entropic-bond 2.0.4
  So that the plugin is tested and built against the current 2.x library API

  Scenario: The manifest declares the entropic-bond ^2.0.4 range. [REQ-1]
    Given the package manifest of the plugin
    When the entropic-bond dependency range is read
    Then the declared range is "^2.0.4"

  Scenario: The lockfile resolves entropic-bond to 2.0.4. [REQ-2]
    Given the lockfile of the plugin
    When the resolved entropic-bond version is read
    Then the resolved version is "2.0.4"

  Scenario: No other dependency changes its resolved version. [REQ-3]
    Given the lockfile before the bump
    When the entropic-bond bump is applied
    Then every other locked package keeps its resolved version

  Scenario: The test suite passes against entropic-bond 2.0.4. [REQ-4]
    Given the plugin declares entropic-bond "^2.0.4"
    When the test suite runs
    Then every test passes

  Scenario: The build succeeds against entropic-bond 2.0.4. [REQ-5]
    Given the plugin declares entropic-bond "^2.0.4"
    When the build runs
    Then the build completes without errors
