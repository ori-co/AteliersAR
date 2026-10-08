const fs = require('fs')
const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')

const createVirtualEntryPlugin = require('./entry-plugin')
const createDev8Plugin = require('./dev8-plugin')

const rootPath = process.cwd()
const distPath = path.join(rootPath, 'dist')
const srcPath = path.join(rootPath, 'src')
// <dir>/ files matching `pattern` → dist/<dir>/, plus dist/<dir>/index.json (the file list), read by the overlay in src/index.html:
// photos/ for the gallery, video/ for the video button. No folder or no file: empty list.
class FolderPlugin {
  constructor(dir, pattern) {
    this.dir = dir
    this.pattern = pattern
  }

  apply(compiler) {
    const {Compilation, sources: {RawSource}} = compiler.webpack
    const dirPath = path.join(rootPath, this.dir)
    compiler.hooks.thisCompilation.tap('FolderPlugin', (compilation) => {
      compilation.hooks.processAssets.tap({name: 'FolderPlugin', stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL}, () => {
        const files = fs.existsSync(dirPath)
          ? fs.readdirSync(dirPath).filter(f => this.pattern.test(f)).sort()
          : []
        files.forEach(f => compilation.emitAsset(`${this.dir}/${f}`, new RawSource(fs.readFileSync(path.join(dirPath, f)))))
        compilation.emitAsset(`${this.dir}/index.json`, new RawSource(JSON.stringify(files)))
      })
    })
  }
}

const makeTsLoader = () => ({
  test: /\.ts$/,
  loader: 'ts-loader',
  exclude: /node_modules/,
})

const makeAssetLoader = () => ({
  test: /\..*$/,
  include: [path.join(srcPath, 'assets')],
  loader: path.join(__dirname, 'asset-loader.js'),
})

const config = {
  entry: './entry.js',
  output: {
    filename: 'bundle.js',
    path: distPath,
    publicPath: '/',
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.join(srcPath, 'index.html'),
      filename: 'index.html',
      scriptLoading: 'blocking',
      inject: false,
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.join(rootPath, 'node_modules/@8thwall/ecs/dist'),
          to: path.join(distPath, 'external/runtime'),
        },
        {
          from: path.join(rootPath, 'node_modules/@8thwall/engine-binary/dist'),
          to: path.join(distPath, 'external/xr'),
        },
        {
          from: path.join(srcPath, 'assets'),
          to: path.join(distPath, 'assets'),
          noErrorOnMissing: true,
        },
        {
          from: path.join(rootPath, 'image-targets'),
          to: path.join(distPath, 'image-targets'),
          noErrorOnMissing: true,
        },
      ],
    }),
    new FolderPlugin('photos', /\.(jpe?g|png)$/i),
    new FolderPlugin('video', /\.(mp4|webm|mov)$/i),
    createVirtualEntryPlugin({
      srcDir: srcPath,
    }),
  ],
  resolve: {extensions: ['.ts', '.js']},
  module: {
    rules: [
      makeTsLoader(),
      makeAssetLoader(),
    ],
  },
  mode: 'production',
  context: srcPath,
  externals: {
    '@8thwall/ecs': 'window.ecs',
  },
  devServer: {
    open: false,
    compress: true,
    hot: true,
    liveReload: false,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization',
    },
    client: {
      webSocketURL: 'ws://0.0.0.0/ws',
      overlay: {
        warnings: false,
        errors: true,
      },
    },
  },
}

module.exports = (_, argv) => {
  if (argv.mode === 'development') {
    return {
      ...config,
      plugins: [
        ...config.plugins,
        createDev8Plugin({src: './external/dev8/dev8.js'}),
        new CopyWebpackPlugin({
          patterns: [{
            from: path.join(rootPath, 'node_modules/@8thwall/ecs/dev8'),
            to: path.join(distPath, 'external/dev8'),
            noErrorOnMissing: true,
          }],
        }),
      ],
    }
  }

  return config
}
