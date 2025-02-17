import _configProvider from '@vamship/config';
import {
    args as _argErrors,
    data as _dataErrors,
    http as _httpErrors
} from '@vamship/error-types';
import _loggerProvider from '@vamship/logger';

import _greetingRoutes from './greeting';
import _healthRoutes from './health';
import _testRoutes from './test';

const {
    BadRequestError,
    NotFoundError,
    UnauthorizedError,
    ForbiddenError
} = _httpErrors;
const { DuplicateRecordError, ConcurrencyControlError } = _dataErrors;
const { SchemaError } = _argErrors;
const _config = _configProvider.getConfig();
const _logger = _loggerProvider.getLogger('routes');

/**
 * @module routes
 */
export default {
    setup: (app) => {
        // ----------  Routers ----------
        if (_config.get('app.enableTestRoutes')) {
            _logger.warn('Mounting test routes. Not intended for production!');
            app.use('/__test__', _testRoutes);
        }

        _logger.info('Mounting health check routes', {
            path: '/health'
        });
        app.use('/health', _healthRoutes);

        _logger.info('Mounting greeting routes', {
            path: '/greeting'
        });
        app.use('/greeting', _greetingRoutes);

        _logger.trace('Handler for routes that do not match any paths');
        app.use((req, res, next) => {
            next(new NotFoundError());
        });

        // ----------  Error routes ----------
        _logger.trace('Setting up schema validation error handler');
        app.use((err, req, res, next) => {
            if (err instanceof SchemaError) {
                next(new BadRequestError(err.message));
            } else {
                next(err);
            }
        });

        _logger.trace('Setting up resource not found error handler');
        app.use((err, req, res, next) => {
            if (err instanceof NotFoundError) {
                res.status(404).json({
                    error: err.message
                });
            } else {
                next(err);
            }
        });

        _logger.trace('Setting up concurrency control error handler');
        app.use((err, req, res, next) => {
            if (err instanceof ConcurrencyControlError) {
                res.status(409).json({
                    error: err.message
                });
            } else {
                next(err);
            }
        });

        _logger.trace('Setting up duplicate record error handler');
        app.use((err, req, res, next) => {
            if (err instanceof DuplicateRecordError) {
                res.status(409).json({
                    error: err.message
                });
            } else {
                next(err);
            }
        });

        _logger.trace('Setting up bad request error handler');
        app.use((err, req, res, next) => {
            if (err instanceof BadRequestError) {
                res.status(400).json({
                    error: err.message
                });
            } else {
                next(err);
            }
        });

        _logger.trace('Setting up authorization error handler');
        app.use((err, req, res, next) => {
            if (err instanceof UnauthorizedError) {
                res.status(401).json({
                    error: err.message
                });
            } else {
                next(err);
            }
        });

        _logger.trace('Setting up forbidden error handler');
        app.use((err, req, res, next) => {
            if (err instanceof ForbiddenError) {
                res.status(403).json({
                    error: err.message
                });
            } else {
                next(err);
            }
        });

        _logger.trace('Setting up catch all error handler');
        app.use((err, req, res, next) => {
            _logger.error(err);
            const message = 'Internal server error';
            res.status(500).json({
                error: message
            });
        });
    }
};
