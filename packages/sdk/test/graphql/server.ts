import "reflect-metadata";
import { PrivateKey, PublicKey, UInt64 } from "o1js";
import {
  Runtime,
  runtimeMethod,
  RuntimeModule,
  runtimeModule,
  state,
} from "@proto-kit/module";
import { Option, Protocol, State, StateMap } from "@proto-kit/protocol";
import {
  Balance,
  Balances,
  BalancesKey,
  TokenId,
  VanillaProtocolModules,
  VanillaRuntimeModules,
} from "@proto-kit/library";
import { Presets } from "@proto-kit/common";
import {
  BlockProducerModule,
  InMemoryDatabase,
  LocalTaskQueue,
  LocalTaskWorkerModule,
  ManualBlockTrigger,
  NoopBaseLayer,
  PrivateMempool,
  Sequencer,
  UnprovenProducerModule,
} from "@proto-kit/sequencer";
import {
  BlockStorageResolver,
  GraphqlSequencerModule,
  GraphqlServer,
  MempoolResolver,
  NodeStatusResolver,
  QueryGraphqlModule,
  UnprovenBlockResolver,
} from "@proto-kit/api";

import { AppChain } from "../../src/appChain/AppChain";
import { StateServiceQueryModule } from "../../src/query/StateServiceQueryModule";
import { InMemorySigner } from "../../src/transaction/InMemorySigner";
import { InMemoryTransactionSender } from "../../src/transaction/InMemoryTransactionSender";
import { container } from "tsyringe";
import { BlockStorageNetworkStateModule } from "../../src/query/BlockStorageNetworkStateModule";
import { MessageBoard } from "./Post";
import { Balances as BaseBalances } from "@proto-kit/library";

@runtimeModule()
export class TestBalances extends Balances {
  /**
   * We use `satisfies` here in order to be able to access
   * presets by key in a type safe way.
   */
  public static presets = {} satisfies Presets<object>;

  @state() public totalSupply = State.from<UInt64>(UInt64);

  @runtimeMethod()
  public getBalance(tokenId: TokenId, address: PublicKey): Balance {
    return super.getBalance(tokenId, address);
  }

  @runtimeMethod()
  public addBalance(tokenId: TokenId, address: PublicKey, balance: UInt64) {
    const totalSupply = this.totalSupply.get();
    this.totalSupply.set(totalSupply.orElse(UInt64.zero).add(balance));

    const previous = this.balances.get(new BalancesKey({ tokenId, address }));
    this.balances.set(
      new BalancesKey({ tokenId, address }),
      previous.orElse(UInt64.zero).add(balance)
    );
  }
}

export async function startServer() {
  const appChain = AppChain.from({
    Runtime: Runtime.from({
      modules: VanillaRuntimeModules.with({
        Balances: TestBalances,
      }),
    }),

    Protocol: Protocol.from({
      modules: VanillaProtocolModules.with({}),
    }),

    Sequencer: Sequencer.from({
      modules: {
        Database: InMemoryDatabase,
        Mempool: PrivateMempool,
        GraphqlServer,
        LocalTaskWorkerModule,
        BaseLayer: NoopBaseLayer,
        BlockProducerModule,
        UnprovenProducerModule,
        BlockTrigger: ManualBlockTrigger,
        TaskQueue: LocalTaskQueue,

        Graphql: GraphqlSequencerModule.from({
          modules: {
            MempoolResolver,
            QueryGraphqlModule,
            BlockStorageResolver,
            UnprovenBlockResolver,
            NodeStatusResolver,
          },

          config: {
            MempoolResolver: {},
            QueryGraphqlModule: {},
            BlockStorageResolver: {},
            NodeStatusResolver: {},
            UnprovenBlockResolver: {},
          },
        }),
      },
    }),

    modules: {
      Signer: InMemorySigner,
      TransactionSender: InMemoryTransactionSender,
      QueryTransportModule: StateServiceQueryModule,
      NetworkStateTransportModule: BlockStorageNetworkStateModule,
    },
  });

  appChain.configure({
    Runtime: {
      Balances: {},
    },

    Protocol: {
      BlockProver: {},
      StateTransitionProver: {},
      AccountState: {},
      BlockHeight: {},
      TransactionFee: {
        tokenId: 0n,
        feeRecipient: PrivateKey.random().toPublicKey().toBase58(),
        baseFee: 0n,
        methods: {},
        perWeightUnitFee: 0n,
      },
    },

    Sequencer: {
      GraphqlServer: {
        port: 8080,
        host: "0.0.0.0",
        graphiql: true,
      },

      Graphql: {
        QueryGraphqlModule: {},
        MempoolResolver: {},
        BlockStorageResolver: {},
        NodeStatusResolver: {},
        UnprovenBlockResolver: {},
      },

      Database: {},
      Mempool: {},
      BlockProducerModule: {},
      LocalTaskWorkerModule: {},
      BaseLayer: {},
      TaskQueue: {},
      UnprovenProducerModule: {},
      BlockTrigger: {},
    },

    TransactionSender: {},
    QueryTransportModule: {},
    NetworkStateTransportModule: {},

    Signer: {
      signer: PrivateKey.random(),
    },
  });

  await appChain.start(container.createChildContainer());
  const pk = PublicKey.fromBase58(
    "B62qmETai5Y8vvrmWSU8F4NX7pTyPqYLMhc1pgX3wD8dGc2wbCWUcqP"
  );

  const balances = appChain.runtime.resolve("Balances");

  const priv = PrivateKey.fromBase58(
    "EKFEMDTUV2VJwcGmCwNKde3iE1cbu7MHhzBqTmBtGAd6PdsLTifY"
  );

  const tokenId = TokenId.from(0);

  const tx = await appChain.transaction(priv.toPublicKey(), () => {
    balances.addBalance(tokenId, priv.toPublicKey(), UInt64.from(1000));
  });
  appChain.resolve("Signer").config.signer = priv;
  await tx.sign();
  await tx.send();

  const tx2 = await appChain.transaction(
    priv.toPublicKey(),
    () => {
      balances.addBalance(tokenId, priv.toPublicKey(), UInt64.from(1000));
    },
    { nonce: 1 }
  );
  await tx2.sign();
  await tx2.send();

  return appChain;
}
