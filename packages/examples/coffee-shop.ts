import { GraphBuilder, Graph, scopes } from "fluoride";

abstract class Heater {
  abstract heat(): void;
}

abstract class Pump {
  abstract pump(): void;
}

class ElectricHeater implements Heater {
  heat() {
    console.log("Heating with electricity.");
  }
}

class GasHeater implements Heater {
  heat() {
    console.log("Heating with gas.");
  }
}

class Thermosiphon implements Pump {
  private readonly heater: Heater;

  constructor(graph: Graph<Heater>) {
    this.heater = graph.resolve(Heater);
  }

  pump() {
    this.heater.heat();
    console.log("Pumping via a thermosiphon.");
  }
}

let makerId: number = 0;
class CoffeeMaker {
  private readonly id: number;
  private readonly pump: Pump;

  constructor(graph: Graph<Pump>) {
    this.id = makerId++;
    this.pump = graph.resolve(Pump);
  }

  make() {
    console.log(`${this.id} / Making coffee...`);
    this.pump.pump();
    console.log(`${this.id} / Coffee is ready.`);
  }
}

class CoffeeShop {
  private readonly graph = GraphBuilder.start(
    Heater,
    Math.random() > 0.5 ? ElectricHeater : GasHeater
  )
    .add(Pump, Thermosiphon)
    .add(CoffeeMaker, CoffeeMaker) // it's quite all right to bind the implementation and interface at once
    .build();

  make(): CoffeeMaker {
    return this.graph.resolve(CoffeeMaker);
  }
}

const coffeeShop = new CoffeeShop();

for (let i = 0; i < 5; i += 1) {
  console.log(`${i + 1}-th coffee maker`);
  const coffeeMaker = coffeeShop.make();
  coffeeMaker.make();
  console.log();
}

class CoffeeLibrary {
  private readonly graph = GraphBuilder.start(Heater, ElectricHeater)
    .add(Pump, Thermosiphon)
    .add(CoffeeMaker, CoffeeMaker, scopes.singleton) // a library instance only has one coffee maker
    .build();

  borrow(): CoffeeMaker {
    return this.graph.resolve(CoffeeMaker);
  }
}

const coffeeLibrary = new CoffeeLibrary();

for (let i = 0; i < 5; i += 1) {
  console.log(`${i + 1}-th borrow`);
  const coffeeMaker = coffeeLibrary.borrow();
  coffeeMaker.make();
  console.log();
}
