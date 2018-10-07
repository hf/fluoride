/**
 * A DI interface is a class, i.e. constructor, for a type.
 * Implementations "implement" the interface defined by the class.
 * The costructor, i.e. the class, is the DI "name" for the type.
 *
 * It's also possible to use abstract classes here as well.
 */
export type Interface<T> =
  | { new (...args: any[]): T }
  | (Function & { prototype: T });

/**
 * An "empty" DI constructor is a class, i.e. constructor, that does not
 * depend on anthing.
 */
export type EmptyConstructor<T> = { new (): T };

/**
 * A "graph" DI constructor is a class, i.e. constructor, that depends on
 * a DI graph to construct new objects.
 */
export type GraphConstructor<D, T> = { new (graph: Graph<D>): T };

/**
 * A DI provider is a special function that receives a DI graph, and returns
 * an object from that graph.
 */
export type Provider<D> = (graph: Graph<D>) => D;

/**
 * A maker function is a function that takes a graph of dependencies as a
 * parameter and returns a newly constructed object. It's like calling
 * `new Constructor(graph)` but without the `new` or the `Constructor`.
 */
export type Maker<D, C> = (graph: Graph<D>) => C;

/**
 * A scope is a special function that takes a {@link Maker} function and
 * returns a function that binds the constructed value (from the maker)
 * to a graph and its interface in some way.
 */
export type Scope<D, I, C extends I> = (
  maker: Maker<D, C>
) => (graph: Graph<D>, iface: Interface<I>) => C;

/**
 * A DI graph is a directed acyclic graph of dependencies. You can use
 * {@link #resolve} to lookup an object from this graph.
 */
export class Graph<D> {
  cov?: D;
  private readonly map: Map<
    Interface<D>,
    (graph: Graph<D>, iface: Interface<D>) => D
  >;

  /**
   * @hide
   */
  constructor(
    map: Map<Interface<D>, (graph: Graph<D>, iface: Interface<D>) => D>
  ) {
    this.map = new Map(map);
  }

  /**
   * Resolve, i.e. lookup an object from the graph that satisfies the DI
   * interface described with the constructor `iface`.
   *
   * It is guaranteed that this object will be resolved.
   *
   * @param iface the DI interface to lookup in the graph
   *
   * @return object the object that was resolved from the graph
   */
  resolve<I>(iface: Interface<I>): I extends D ? I : never {
    const provider = this.map.get(iface as any);

    if (!provider) {
      // because the type is never, nobody can use this value
      // in runtime (or JS) this will throw
      throw new Error(`Unsatisfied dependency for ${iface}`);
    }

    return provider(this, iface as any) as any;
  }

  /**
   * Create a new graph on top of this one. All scopes bound to
   * this graph will be lost in the new graph, but will not be
   * modified in this one.
   */
  modify(): GraphBuilder<D> {
    return new GraphBuilder(this.map);
  }
}

/**
 * Frequently-used DI scopes.
 */
export namespace scopes {
  const singletonSymbol = Symbol("__fluoride_scope_singleton");
  const weakSymbol = Symbol("__fluoride_scope_weak");

  /**
   * Unscoped values. Whenever you request a dependency, it'll be constructed all
   * over again.
   */
  export const none = <D, I, C extends I>(maker: (graph: Graph<D>) => C) => (
    graph: Graph<D>,
    _iface: Interface<I>
  ) => maker(graph);

  /**
   * Singleton values. A dependency will be constructed only once in a graph.
   */
  export const singleton = <D, I, C extends I>(
    maker: (graph: Graph<D>) => C
  ) => (graph: Graph<D>, iface: Interface<I>) => {
    const descriptor = Object.getOwnPropertyDescriptor(graph, singletonSymbol);
    const singletonMap: Map<any, any> =
      (descriptor && descriptor.value) || new Map();

    if (!descriptor) {
      Object.defineProperty(graph, singletonSymbol, {
        configurable: false,
        enumerable: false,
        value: singletonMap
      });
    }

    const value = singletonMap.get(iface) || maker(graph);
    singletonMap.set(iface, value);

    return value;
  };

  /**
   * Weak values. A dependency will be constructed only once in a graph. If it's
   * no longer used, it will be destroyed and then constructed again when resolved
   * again.
   */
  export const weak = <D, I, C extends I>(maker: (graph: Graph<D>) => C) => (
    graph: Graph<D>,
    iface: Interface<I>
  ) => {
    const descriptor = Object.getOwnPropertyDescriptor(graph, weakSymbol);
    const weakMap: WeakMap<any, any> =
      (descriptor && descriptor.value) || new WeakMap();

    if (!descriptor) {
      Object.defineProperty(graph, singletonSymbol, {
        configurable: false,
        enumerable: false,
        value: weakMap
      });
    }

    const value = weakMap.get(iface) || maker(graph);
    weakMap.set(iface, singleton);

    return value;
  };
}

/**
 * Create a safe DI graph, i.e. a directed acyclic graph of dependencies.
 */
export class GraphBuilder<D> {
  private readonly map: Map<
    Interface<D>,
    (graph: Graph<D>, iface: Interface<D>) => D
  >;

  /**
   * @hide
   */
  constructor(map: Map<any, any>) {
    this.map = map;
  }

  /**
   * Create the first node in the graph.
   *
   * @param iface the DI interface to associate with the provided constructor
   * @param ctor the no-dependencies constructor to create the proper object
   * @param scope the scope of the dependency, default is {@link scopes.none}
   */
  static start<I, C extends I>(
    impl: Interface<I>,
    ctor: EmptyConstructor<C>,
    scope: Scope<I, I, C> = scopes.none
  ): GraphBuilder<I> {
    const map = new Map();
    map.set(impl, scope(() => new ctor()));
    return new GraphBuilder(map);
  }

  /**
   * Add a node to the graph.
   *
   * @param iface the DI interface to associate with the provide constructor
   * @param ctor the no-dependencies or graph-dependencies constructor to create the proper object
   * @param scope the scope of the dependency, default is {@link scope.none}
   */
  add<I, P, C extends I, O = D>(
    impl: Interface<I>,
    ctor: GraphConstructor<P, C>, // also supports EmptyConstructor by default
    scope: Scope<P, I | O, C> = scopes.none
  ): D extends P ? GraphBuilder<I | O> : never {
    const map = new Map<any, any>(this.map);

    map.set(impl, scope(graph => new ctor(graph)));

    // because we typecheck, you can never build a graph if the compiler infers never
    return new GraphBuilder(map) as any;
  }

  /**
   * Take a snapshot of the built graph and use it to resolve objects.
   */
  build(): Graph<D> {
    return new Graph<D>(this.map);
  }
}
