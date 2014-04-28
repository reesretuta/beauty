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
        }
    });

    grunt.loadNpmTasks('grunt-spritesmith');
    grunt.registerTask('default', 'sprite');
};
