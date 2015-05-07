module.exports = function(grunt) {
    grunt.initConfig({
        sprite: {
            dist: {
                src: ['sprites/*.png'],
                destImg: 'src/main/webapp/images/sprites.png',
                destCSS: 'src/main/webapp/styles/sprites.less',
                cssFormat: 'less',
                imgPath: '../images/sprites.png',
                algorithm: 'left-right',
                engineOpts: {
                    'imagemagick': true
                }
            }
        },
        markdownpdf: {
            options: {
              // Task-specific options go here.
            },
            files: {
              src: "api_example.md",
              dest: "./"
            }
        }
    });

    grunt.loadNpmTasks('grunt-spritesmith');
    grunt.loadNpmTasks('grunt-markdown-pdf');
    grunt.registerTask('default', 'sprite');
};
