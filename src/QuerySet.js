import mapValues from 'lodash/mapValues';
import { normalizeEntity } from './utils';

import {
    UPDATE,
    DELETE,
    FILTER,
    EXCLUDE,
    ORDER_BY,
} from './constants.js';

/**
 * A chainable class that keeps track of a list of objects and
 *
 * - returns a subset clone of itself with [filter]{@link QuerySet#filter} and [exclude]{@link QuerySet#exclude}
 * - records updates to objects with [update]{@link QuerySet#update} and [delete]{@link QuerySet#delete}
 *
 */
const QuerySet = class QuerySet {
    /**
     * Creates a QuerySet.
     *
     * @param  {Model} modelClass - the model class of objects in this QuerySet.
     * @param  {any[]} clauses - query clauses needed to evaluate the set.
     * @param {Object} [opts] - additional options
     */
    constructor(modelClass, clauses, opts) {
        Object.assign(this, {
            modelClass,
            clauses: clauses || [],
        });

        this._opts = opts;
    }

    static addSharedMethod(methodName) {
        this.sharedMethods = this.sharedMethods.concat(methodName);
    }

    _new(clauses, userOpts) {
        const opts = Object.assign({}, this._opts, userOpts);
        return new this.constructor(this.modelClass, clauses, opts);
    }

    toString() {
        this._evaluate();
        const contents = this.rows.map(id =>
            this.modelClass.withId(id).toString()
        ).join('\n    - ');
        return `QuerySet contents: \n    - ${contents}`;
    }

    /**
     * Returns an array of the plain objects represented by the QuerySet.
     * The plain objects are direct references to the store.
     *
     * @return {Object[]} references to the plain JS objects represented by
     *                    the QuerySet
     */
    toRefArray() {
        this._evaluate();
        return this.rows;
    }

    /**
     * Returns an array of Model instances represented by the QuerySet.
     * @return {Model[]} model instances represented by the QuerySet
     */
    toModelArray() {
        this._evaluate();
        const ModelClass = this.modelClass;
        return this.rows.map(props => new ModelClass(props));
    }

    /**
     * Returns the number of model instances represented by the QuerySet.
     *
     * @return {number} length of the QuerySet
     */
    count() {
        this._evaluate();
        return this.rows.length;
    }

    /**
     * Checks if the {@link QuerySet} instance has any entities.
     *
     * @return {Boolean} `true` if the {@link QuerySet} instance contains entities, else `false`.
     */
    exists() {
        return Boolean(this.count());
    }

    /**
     * Returns the {@link Model} instance at index `index` in the {@link QuerySet} instance if
     * `withRefs` flag is set to `false`, or a reference to the plain JavaScript
     * object in the model state if `true`.
     *
     * @param  {number} index - index of the model instance to get
     * @return {Model|Object} a {@link Model} instance or a plain JavaScript
     *                        object at index `index` in the {@link QuerySet} instance
     */
    at(index) {
        this._evaluate();
        const ModelClass = this.modelClass;
        return new ModelClass(this.rows[index]);
    }

    /**
     * Returns the {@link Model} instance at index 0 in the {@link QuerySet} instance.
     * @return {Model}
     */
    first() {
        return this.at(0);
    }

    /**
     * Returns the {@link Model} instance at index `QuerySet.count() - 1`
     * @return {Model}
     */
    last() {
        this._evaluate();
        return this.at(this.rows.length - 1);
    }

    /**
     * Returns a new {@link QuerySet} instance with the same entities.
     * @return {QuerySet} a new QuerySet with the same entities.
     */
    all() {
        return this._new(this.clauses);
    }

    /**
     * Returns a new {@link QuerySet} instance with entities that match properties in `lookupObj`.
     *
     * @param  {Object} lookupObj - the properties to match objects with.
     * @return {QuerySet} a new {@link QuerySet} instance with objects that passed the filter.
     */
    filter(lookupObj) {
        const normalizedLookupObj = typeof lookupObj === 'object'
            ? mapValues(lookupObj, normalizeEntity)
            : lookupObj;
        const filterDescriptor = { type: FILTER, payload: normalizedLookupObj };
        return this._new(this.clauses.concat(filterDescriptor));
    }

    /**
     * Returns a new {@link QuerySet} instance with entities that do not match properties in `lookupObj`.
     *
     * @param  {Object} lookupObj - the properties to unmatch objects with.
     * @return {QuerySet} a new {@link QuerySet} instance with objects that passed the filter.
     */
    exclude(lookupObj) {
        const normalizedLookupObj = typeof lookupObj === 'object'
            ? mapValues(lookupObj, normalizeEntity)
            : lookupObj;
        const excludeDescriptor = { type: EXCLUDE, payload: normalizedLookupObj };
        return this._new(this.clauses.concat(excludeDescriptor));
    }

    _evaluate() {
        if (!this._evaluated) {
            const session = this.modelClass.session;
            const querySpec = {
                table: this.modelClass.modelName,
                clauses: this.clauses,
            };
            const { rows } = session.db.query(querySpec, session.state);
            this.rows = rows;
            this._evaluated = true;
        }
    }

    /**
     * Returns a new {@link QuerySet} instance with entities ordered by `iteratees` in ascending
     * order, unless otherwise specified. Delegates to `lodash.orderBy`.
     *
     * @param  {string[]|Function[]} iteratees - an array where each item can be a string or a
     *                                           function. If a string is supplied, it should
     *                                           correspond to property on the entity that will
     *                                           determine the order. If a function is supplied,
     *                                           it should return the value to order by.
     * @param {Boolean[]} [orders] - the sort orders of `iteratees`. If unspecified, all iteratees
     *                               will be sorted in ascending order. `true` and `'asc'`
     *                               correspond to ascending order, and `false` and `'desc`
     *                               to descending order.
     * @return {QuerySet} a new {@link QuerySet} with objects ordered by `iteratees`.
     */
    orderBy(iteratees, orders) {
        const orderByDescriptor = { type: ORDER_BY, payload: [iteratees, orders] };
        return this._new(this.clauses.concat(orderByDescriptor));
    }

    /**
     * Records an update specified with `mergeObj` to all the objects
     * in the {@link QuerySet} instance.
     *
     * @param  {Object} mergeObj - an object to merge with all the objects in this
     *                             queryset.
     * @return {undefined}
     */
    update(mergeObj) {
        this.modelClass.session.applyUpdate({
            action: UPDATE,
            query: {
                table: this.modelClass.modelName,
                clauses: this.clauses,
            },
            payload: mergeObj,
        });
        this._evaluated = false;
    }

    /**
     * Records a deletion of all the objects in this {@link QuerySet} instance.
     * @return {undefined}
     */
    delete() {
        this.toModelArray().forEach(model => model._onDelete());

        this.modelClass.session.applyUpdate({
            action: DELETE,
            query: {
                table: this.modelClass.modelName,
                clauses: this.clauses,
            },
        });

        this._evaluated = false;
    }
};

QuerySet.sharedMethods = [
    'count',
    'at',
    'all',
    'last',
    'first',
    'exists',
    'filter',
    'exclude',
    'orderBy',
    'update',
    'delete',
];

export default QuerySet;
