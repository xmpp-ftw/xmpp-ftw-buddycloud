'use strict';

module.exports = function(grunt) {

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        jshint: {
            allFiles: ['gruntfile.js', 'lib/**/*.js', 'test/**/*.js'],
            options: {
                jshintrc: '.jshintrc',
            }
        },
        mochacli: {
            all: ['test/**/*.js'],
            options: {
                reporter: 'spec',
                ui: 'tdd'
            }
        }
    })

    // Load the plugins
    grunt.loadNpmTasks('grunt-contrib-jshint')
    grunt.loadNpmTasks('grunt-mocha-cli')
    
    grunt.registerTask('setTimeZone', 'Set GMT timezone', function() {
      process.env.TZ = 'Europe/London' 
    })

    // Configure tasks
    grunt.registerTask('default', ['test'])
    grunt.registerTask('test', ['setTimeZone', 'mochacli', 'jshint'])
}
