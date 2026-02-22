module.exports = {
  default: {
    requireModule: ['tsx/cjs'],
    require: ['features/steps/**/*.ts'],
    paths: ['features/**/*.feature'],
    format: ['progress-bar', 'html:cucumber-report.html'],
  },
};
