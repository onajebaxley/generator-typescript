'use strict';

const { Directory } = require('@vamship/grunt-utils');
const _camelcase = require('camelcase');

// -------------------------------------------------------------------------------
//  Help documentation
// -------------------------------------------------------------------------------
//prettier-ignore
const HELP_TEXT =
'--------------------------------------------------------------------------------\n' +
' Defines tasks that are commonly used during the development process. This      \n' +
' includes tasks for linting, building and testing.                              \n' +
'                                                                                \n' +
' Supported Tasks:                                                               \n' +
'   [default]         : Shows help documentation.                                \n' +
'                                                                                \n' +
'   help              : Shows this help message.                                 \n' +
'                                                                                \n' +
'   clean             : Cleans out all build artifacts and other temporary files \n' +
'                       or directories.                                          \n' +
'                                                                                \n' +
'   monitor:[target]: : Monitors files for changes, and triggers an action based \n' +
'                       on the sub target. Supported sub targets are as follows: \n' +
'                        [lint]    : Performs linting with default options       \n' +
'                                    against all source files.                   \n' +
'                        [unit]    : Executes unit tests against all source      \n' +
'                                    files.                                      \n' +
'                        [docs]    : Regenerates project documentation based     \n' +
'                                    on typedoc.                                 \n' +
'                        [build]   : Generates javascript code from typescript   \n' +
'                                    sources. If this target is specified,       \n' +
'                                    all other monitoring targets will be        \n' +
'                                    skipped.                                    \n' +
'                                                                                \n' +
'                       The monitor task will only perform one action at a time. \n' +
'                       If watches need to be executed on multiple targets,      \n' +
'                       separate `grunt monitor` tasks may be run in parallel.   \n' +
'                                                                                \n' +
'                       If a specific task requires a web server to be launched, \n' +
'                       that will be done automatically.                         \n' +
'                                                                                \n' +
'   lint              : Performs linting of all source and test files.           \n' +
'                                                                                \n' +
'   format            : Formats source and test files.                           \n' +
'                                                                                \n' +
'   docs              : Generates project documentation.                         \n' +
'                                                                                \n' +
'   build             : Builds the project - generates javascript from           \n' +
'                       typescript sources.                                      \n' +
'                                                                                \n' +
'   dist              : Creates a distribution for the project in the dist       \n' +
'                       directory, preparing the package for publication.        \n' +
<% if(dockerRequired) {-%>
'                                                                                \n' +
'   packge            : Packges the api server into a docker container. This     \n' +
'                       task assumes that the server has been built, and prepared\n' +
'                       for distribution.                                        \n' +
'                                                                                \n' +
'   publish[:[tags]]  : Publishes a packaged docker container to a docker        \n' +
'                       registry. This assumes that docker credentials have been \n' +
'                       setup correctly, and that the package has already been   \n' +
'                       created using the package task.                          \n' +
'                       This task accepts additional tags to associate with the  \n' +
'                       repo when publishing. The image is always tagged and     \n' +
'                       published with the current project version whether or    \n' +
'                       not any additional tags are specified.                   \n' +
<% } -%>
'                                                                                \n' +
'   test:[unit]       : Executes unit tests against source files.                \n' +
'                                                                                \n' +
'   bump:[major|minor]: Updates the version number of the package. By default,   \n' +
'                       this task only increments the patch version number. Major\n' +
'                       and minor version numbers can be incremented by          \n' +
'                       specifying the "major" or "minor" subtask.               \n' +
'                                                                                \n' +
'   all               : Performs standard pre-checkin activities. Runs           \n' +
'                       formatting on all source files, validates the files      \n' +
'                       (linting), and executes tests against source code.       \n' +
'                       All temporary files/folders are cleaned up on task       \n' +
'                       completion.                                              \n' +
'                                                                                \n' +
' Supported Options:                                                             \n' +
'   --test-suite      : Can be used to specify a unit test suite to execute when \n' +
'                       running tests. Useful when development is focused on a   \n' +
'                       small section of the app, and there is no need to retest \n' +
'                       all components when runing a watch.                      \n' +
'                                                                                \n' +
' IMPORTANT: Please note that while the grunt file exposes tasks in addition to  \n' +
' ---------  the ones listed below (no private tasks in grunt yet :( ), it is    \n' +
'            strongly recommended that just the tasks listed below be used       \n' +
'            during the dev/build process.                                       \n' +
'                                                                                \n' +
'--------------------------------------------------------------------------------';

module.exports = function(grunt) {
    /* ------------------------------------------------------------------------
     * Initialization of dependencies.
     * ---------------------------------------------------------------------- */
    //Load all grunt tasks by reading package.json. Ignore @vamshi/grunt-utils,
    //which is actually a utility library and not a grunt task.
    require('load-grunt-tasks')(grunt, {
        pattern: ['grunt-*', '@vamship/grunt-*', '!@vamship/grunt-utils']
    });

    /* ------------------------------------------------------------------------
     * Project structure and static parameters.
     * ---------------------------------------------------------------------- */
    const PROJECT = Directory.createTree('./', {
        src: null,
        test: {
            unit: null
        },
        working: {
            src: null,
            test: {
                unit: null
            }
        },
        dist: null,
        docs: null,
        node_modules: null,
        coverage: null,
        '.nyc_output': null,
        '.tscache': null
    });

    const packageConfig = grunt.file.readJSON('package.json') || {};

    PROJECT.appName = packageConfig.name || '__UNKNOWN__';
    PROJECT.version = packageConfig.version || '__UNKNOWN__';
    PROJECT.description = packageConfig.description || '';
<% if(dockerRequired) {-%>
    PROJECT.unscopedName = PROJECT.appName.replace(/^@[^/]*\//, '');
<%     if(dockerCustomRegistry) { -%>
    PROJECT.dockerRepo = `<%= dockerCustomRegistry %>/${PROJECT.unscopedName}`;
<%     } else { -%>
    PROJECT.dockerRepo = `${PROJECT.appName.replace(/^@/, '')}`;
<%     } -%>
    PROJECT.dockerTag = `${PROJECT.dockerRepo}:${PROJECT.version}`;
<% } -%>

    // Shorthand references to key folders.
    const SRC = PROJECT.getChild('src');
    const TEST = PROJECT.getChild('test');
    const DOCS = PROJECT.getChild('docs');
    const WORKING = PROJECT.getChild('working');
    const DIST = PROJECT.getChild('dist');
    const NODE_MODULES = PROJECT.getChild('node_modules');
    const COVERAGE = PROJECT.getChild('coverage');
    const TSCACHE = PROJECT.getChild('.tscache');
    const NYC = PROJECT.getChild('.nyc_output');

    /* ------------------------------------------------------------------------
     * Grunt task configuration
     * ---------------------------------------------------------------------- */
    grunt.initConfig({
        /**
         * Configuration for grunt-contrib-copy, which is used to:
         * - Copy files from transpiled (working) to distribution targets
         */
        copy: {
            dist: {
                expand: true,
                cwd: WORKING.getChild('src').path,
                src: ['**/*.js', '**/*.d.ts'],
                dest: DIST.path
            }
        },

        /**
         * Configuration for grunt-contrib-clean, which is used to:
         *  - Remove temporary files and folders.
         */
        clean: {
            coverage: [COVERAGE.path],
            tscache: [TSCACHE.path],
            nyc: [NYC.path],
            ctags: [PROJECT.getFilePath('tags')],
            dist: [DIST.path],
            working: [WORKING.path],
            temp: [PROJECT.getFilePath('tscommand-*.tmp.txt')]
        },

        /**
         * Configuration for grunt-prettier, which is used to:
         *  - Format javascript source code
         */
        prettier: {
            files: {
                src: [
                    'README.md',
                    'Gruntfile.js',
                    SRC.getAllFilesPattern('ts'),
                    TEST.getAllFilesPattern('ts')
                ]
            }
        },

        /**
         * Configuration for grunt-tslint, which is used to:
         *  - Lint source and test files.
         */
        tslint: {
            options: {
                configuration: PROJECT.getFilePath('tslint.json'),
                project: PROJECT.getFilePath('tsconfig.json')
            },
            default: {
                src: [
                    SRC.getAllFilesPattern('ts'),
                    TEST.getAllFilesPattern('ts')
                ]
            }
        },

        /**
         * Configuration for grunt-ts, which is used to:
         *  - Transpile typescript into javascript.
         */
        ts: {
            default: {
                tsconfig: PROJECT.getFilePath('tsconfig.json')
            },
            monitor: {
                watch: [SRC.getAllFilesPattern(), TEST.getAllFilesPattern()],
                tsconfig: PROJECT.getFilePath('tsconfig.json')
            }
        },

<% if(dockerRequired) {-%>
        /**
         * Configuration for grunt-shell, which is used to execute:
         * - Build docker images using the docker cli
         * - Publish docker images to ECR
         * - Run mocha tests with code coverage
         */
        shell: {
            dockerBuild: {
                command: () => {
                    const npmToken = process.env.NPM_TOKEN;
                    if (!npmToken) {
                        throw new Error(
                            'Cannot build package - NPM_TOKEN not found in env'
                        );
                    }

                    return `docker build --rm --tag ${
                        PROJECT.dockerTag
                    } ${__dirname} --build-arg APP_NAME=${
                        PROJECT.unscopedName
                    } --build-arg APP_DESCRIPTION='${
                        PROJECT.description
                    }' --build-arg APP_VERSION='${
                        PROJECT.version
                    }' --build-arg NPM_TOKEN=${
                        npmToken
                    } --build-arg CONFIG_NAME=${_camelcase(
                        PROJECT.unscopedName
                    )} --build-arg BUILD_TIMESTAMP=${Date.now()}`
                }
            },
            dockerPublish: {
                command: `docker push ${PROJECT.dockerTag}`
            },
            dockerTagAndPublish: {
                command: (tag) => {
                    tag = tag || PROJECT.version;
                    const targetTag = `${PROJECT.dockerRepo}:${tag}`;
                    return [
                        `docker tag ${PROJECT.dockerTag} ${targetTag}`,
                        `docker push ${targetTag}`
                    ].join('&&');
                }
            },
            test: {
                command: () => {
                    return [
                        'nyc --reporter text-summary --reporter html ',
                        'mocha --color -R spec --recursive ',
                        '<%%= shell.test.__path %%>'
                    ].join(' ');
                }
            }
        },
<% }-%>

        /**
         * Configuration for grunt-typedoc, which can be used to:
         *  - Generate code documentation.
         */
        typedoc: {
            default: {
                options: {
                    module: 'commonjs',
                    out: DOCS.getFilePath(
                        `${PROJECT.appName}/${PROJECT.version}`
                    ),
                    name: `${PROJECT.appName} Documentation`,
                    ignoreCompilerErrors: true,
                    ignorePrivate: true,
                    target: 'ES5'
                },
                src: [SRC.getAllFilesPattern('ts')]
            }
        },

        /**
         * Configuration for grunt-contrib-watch, which is used to:
         *  - Monitor all source/test files and trigger actions when these
         *    files change.
         */
        watch: {
            workingFiles: {
                files: [WORKING.getAllFilesPattern('js')],
                tasks: []
            },
            sourceFiles: {
                files: [
                    SRC.getAllFilesPattern('ts'),
                    TEST.getAllFilesPattern('ts')
                ],
                tasks: []
            }
        },

        /**
         * Configuration for grunt-bump, which is used to:
         *  - Update the version number on package.json
         */
        bump: {
            options: {
                push: false
            }
        }
    });

    /* ------------------------------------------------------------------------
     * Task registrations
     * ---------------------------------------------------------------------- */

    /**
     * "Private task" - ensure that the working directory exists. Typically
     * invoked before invoking tasks that require the working directory to
     * exist.
     */
    grunt.registerTask('_ensureBuild', () => {
        if (!this.file.exists(WORKING.path)) {
            // Run a build first to ensure that compiled files exist.
            grunt.log.warn('No working directory found. Building sources');
            grunt.task.run('build');
        }
    });

    /**
     * Test task - executes lambda tests against code in dev only.
     */
    grunt.registerTask('test', 'Executes tests against sources', (testType) => {
        testType = testType || 'unit';

        const tasks = [];
        if (['unit'].indexOf(testType) >= 0) {
            let testSuite = grunt.option('test-suite');
            let testTarget = WORKING.getChild(`test/${testType}`);

            if (typeof testSuite === 'string' && testSuite.length > 0) {
                if (!testSuite.endsWith('.js')) {
                    grunt.log.warn('Adding .js suffix to test suite');
                    testSuite = `${testSuite}.js`;
                }
                testTarget = testTarget.getFilePath(testSuite);

                grunt.log.writeln(`Running test suite: [${testSuite}]`);
                grunt.log.writeln(`Tests will be limited to: [${testTarget}]`);
            } else {
                testTarget = testTarget.absolutePath;
                grunt.log.writeln(`Running all tests of type: [${testType}]`);
            }

            grunt.config.set('shell.test.__path', testTarget);
            tasks.push('shell:test');
        }

        if (tasks.length > 0) {
            grunt.task.run('_ensureBuild');
            grunt.task.run(tasks);
        } else {
            grunt.log.error(`Unrecognized test type: [${testType}]`);
            grunt.log.warn('Type "grunt help" for help documentation');
        }
    });

    /**
     * Monitor task - track changes on different sources, and enable auto
     * execution of tests if requested.
     *  - If arguments are specified (see help) execute the necessary actions
     *    on changes.
     */
    grunt.registerTask(
        'monitor',
        'Monitors source files for changes, and performs tasks as necessary',
        (target) => {
            const validTasks = {
                docs: ['docs'],
                lint: ['lint'],
                unit: ['test:unit'],
                build: ['ts:monitor']
            };

            const tasks = validTasks[target];
            const watchTask =
                ['docs', 'lint', 'build'].indexOf(target) >= 0
                    ? 'sourceFiles'
                    : 'workingFiles';

            if (tasks) {
                grunt.log.writeln(`Tasks to run on change: [${tasks}]`);
                grunt.config.set(`watch.${watchTask}.tasks`, tasks);
                grunt.task.run(`watch:${watchTask}`);
            } else {
                grunt.log.error('No valid tasks to execute on change');
                grunt.log.warn('Type "grunt help" for help documentation');
            }
        }
    );

    /**
     * Lint task - checks source and test files for linting errors.
     */
    grunt.registerTask('lint', ['tslint:default']);

    /**
     * Formatter task - formats all source and test files.
     */
    grunt.registerTask('format', ['prettier']);

    /**
     * Build task - Builds typescript files into javascript
     */
    grunt.registerTask('build', ['ts:default']);

    /**
     * Documentation task - generates documentation for the project.
     */
    grunt.registerTask('docs', ['typedoc:default', 'copy:docs']);

    /**
     * Distribution task - prepares files for packaging by building, compiling
     * and copying results to the dist directory.
     */
    grunt.registerTask('dist', [
        'clean',
        'format',
        'lint',
        'build',
        'test:unit',
        'copy:dist'
    ]);

    /**
     * Packaging task - packages the application for release by building a
     * docker container.
     */
    grunt.registerTask('package', ['shell:dockerBuild']);

    /**
     * Publish task - publishes an packaged image to the docker registry.
     */
    grunt.registerTask('publish', (...tags) => {
        const tasks = ['shell:dockerPublish'].concat(
            tags.map((tag) => `shell:dockerTagAndPublish:${tag}`)
        );
        grunt.task.run(tasks);
    });

    /**
     * Pre check in task. Intended to be run prior to commiting/pushing code.
     * Performs the following actions:
     *  - Format files
     *  - Lint files
     *  - Test source code
     *  - Cleaning up temporary files
     */
    grunt.registerTask('all', [
        'clean',
        'format',
        'lint',
        'build',
        'test:unit',
        'clean'
    ]);

    /**
     * Shows help information on how to use the Grunt tasks.
     */
    grunt.registerTask('help', 'Displays grunt help documentation', () => {
        grunt.log.writeln(HELP_TEXT);
    });

    /**
     * Default task. Shows help information.
     */
    grunt.registerTask('default', ['help']);
};
