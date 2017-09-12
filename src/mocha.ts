import { config, Config, parseStoryName } from './config';

export function setupMocha() {
  let Mocha = require('mocha');
  let Suite = require('mocha/lib/suite');
  let Test = require('mocha/lib/test');

  /**
 * This example is identical to the TDD interface, but with the addition of a
 * "comment" function:
 * https://github.com/mochajs/mocha/blob/master/lib/interfaces/tdd.js
 */
  module.exports = Mocha.interfaces['snapshots'] = function(currentSuite: any) {
    let suites = [currentSuite];

    currentSuite.on('pre-require', function(context: any, file: any, mocha: any) {
      let common = require('mocha/lib/interfaces/common')(suites, context);

      /**
     * Use all existing hook logic common to UIs. Common logic can be found in
     * https://github.com/mochajs/mocha/blob/master/lib/interfaces/common.js
     */
      context.beforeEach = common.beforeEach;
      context.afterEach = common.afterEach;
      context.before = common.before;
      context.after = common.after;
      context.describe = common.describe;
      context.run = mocha.options.delay && common.runWithSuite(currentSuite);

      context.describe = context.context = function(title: any, fn: any) {
        return common.suite.create({
          title: title,
          file: file,
          fn: fn
        });
      };

      context.storyOf = function(title: string, props: any, fn: any) {
        const parsed = parseStoryName(title);
        context.describe(parsed.fileName, () => fn(props));
      };

      /**
     * Pending describe.
     */

      context.xdescribe = context.xcontext = context.describe.skip = function(title: string, fn: any) {
        const pr = require('proxyrequire');
        if (pr) { pr.unmockAll(); }

        return common.suite.skip({
          title: title,
          file: file,
          fn: fn
        });
      };

      /**
     * Exclusive suite.
     */

      context.describe.only = function(title: any, fn: any) {
        return common.suite.only({
          title: title,
          file: file,
          fn: fn
        });
      };

      /**
     * Describe a specification or test-case
     * with the given `title` and callback `fn`
     * acting as a thunk.
     */

      /**
     * Exclusive test-case.
     */

      context.it.only = function(title: any, fn: any) {
        return common.test.only(mocha, context.it(title, fn));
      };

      /**
     * Pending test case.
     */

      context.xit = context.xspecify = context.it.skip = function(title: string) {
        // context.it(title);
      };

      /**
     * Number of attempts to retry.
     */
      context.it.retries = function(n: number) {
        context.retries(n);
      };

      context.config = function() {};

      context.it = context.specify = function(title: string, fn: any) {
        let suite = suites[0];
        let newFn = function() {
          try {
            let topParent = '';
            let name = this.test.title;
            let parent = this.test.parent;
            while (parent != null) {
              if (parent.parent && parent.parent.title) {
                name = parent.title + ' ' + name;
              }
              if (parent.title) {
                topParent = parent.title;
              }
              parent = parent.parent;
            }

            config.currentTask = {
              className: topParent,
              title: name
            };
            // config.snapshotCalls = null;
            // console.log('!!!!!!!!!!!!!!!!');
            // console.log(TestConfig.currentTask);
            return fn();
          } catch (ex) {
            throw ex;
          }
        };
        if (suite.isPending()) {
          newFn = null;
        }
        let test = new Test(title, newFn);
        test.file = file;
        suite.addTest(test);
        return test;
      };
    });
  };
}
