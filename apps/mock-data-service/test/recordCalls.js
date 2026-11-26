/**
 * Records calls made to injected broadcaster collaborators.
 * Role: Gives use-case tests a broadcaster whose every method call is kept in order.
 * Not in this file: JSON stores (test/invokeRouter.js) or assertions.
 * Key dependencies: none.
 * See also: src/domain/placeOrder.test.js.
 */

/**
 * Creates an object whose named methods record their arguments.
 *
 * @param {string[]} methodNames - Methods the collaborator exposes.
 * @returns {{ calls: Array<[string, ...unknown[]]> } & Record<string, (...args: unknown[]) => void>} Recorder; `calls` holds `[methodName, ...args]` per call.
 */
function recordCalls(methodNames) {
  const recorder = { calls: [] };
  methodNames.forEach((methodName) => {
    recorder[methodName] = (...args) => {
      recorder.calls.push([methodName, ...args]);
    };
  });
  return recorder;
}

module.exports = { recordCalls };
