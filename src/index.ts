// Copyright 2025 IOTA Stiftung
// SPDX-License-Identifier: Apache-2.0

import {NotarizationClient, NotarizationClientReadOnly, TimeLock} from "@iota/notarization/node";
import {strict as assert} from "assert";
import {Ed25519Keypair} from "@iota/iota-sdk/keypairs/ed25519";
import {getNetwork, IotaClient, NetworkId} from "@iota/iota-sdk/client";
import {getFaucetHost, requestIotaFromFaucetV0} from "@iota/iota-sdk/faucet";
import {Ed25519KeypairSigner} from "@iota/iota-interaction-ts/node/test_utils";

const networkId: NetworkId = "testnet"; // Change to "mainnet" for mainnet

async function requestFunds(address: string) {
    await requestIotaFromFaucetV0({
        host: getFaucetHost(networkId),
        recipient: address,
    });
}

async function getFundedNotarizationClient(iotaClient: IotaClient) {
    // generate new key
    const keypair = Ed25519Keypair.generate();
    // create signer
    let signer = new Ed25519KeypairSigner(keypair);
    // Request funds from faucet to execute the transactions resulting from this example
    await requestFunds(signer.keyId());

    const balance = await iotaClient.getBalance({ owner: signer.keyId() });
    if (balance.totalBalance === "0") {
        throw new Error("Balance is still 0");
    } else {
        console.log(
            `Received gas from faucet: ${balance.totalBalance} for owner ${signer.keyId()}`,
        );
    }

    const notarizationClientReadOnly = await NotarizationClientReadOnly.create(iotaClient);
    return await NotarizationClient.create(notarizationClientReadOnly, signer);
}

/** Demonstrate how to create a Locked Notarization and publish it. */
export async function createLocked(): Promise<void> {
    console.log("Creating a simple locked notarization example");

    const iotaClient = new IotaClient({ url: getNetwork(networkId).url });

    // create a new client that offers notarization related functions
    const notarizationClient = await getFundedNotarizationClient(iotaClient);

    // Calculate an unlock time (24 hours from now) to be used for deleteLock
    const delete_unlock_at = Math.round(Date.now() / 1000 + 86400); // 24 hours

    const utf8Encode = new TextEncoder();

    // create a new Locked Notarization
    console.log("Building a simple locked notarization and publish it to the IOTA network");
    const { output: notarization } = await notarizationClient
        .createLocked()
        // Control the type of State data by choosing one of the `with...State` functions below.
        // Uncomment or comment the following lines to choose between string or byte State data.
        //
        // .withStringState("Important document content", "Document metadata e.g., version specifier")
        // .withBytesState(utf8Encode.encode("Important document content"), "Document metadata e.g., version specifier")
        .withBytesState(
            Uint8Array.from([14, 255, 0, 125, 64, 87, 11, 114, 108, 100]),
            "Document metadata e.g., version specifier",
        )
        .withDeleteLock(TimeLock.withUnlockAt(delete_unlock_at))
        .withImmutableDescription("This can not be changed any more")
        .withUpdatableMetadata("This can be updated")
        .finish()
        .buildAndExecute(notarizationClient);

    console.log("\n✅ Locked notarization created successfully!");

    // check some important properties of the received OnChainNotarization
    console.log("\n----------------------------------------------------");
    console.log("----- Important Notarization Properties ------------");
    console.log("----------------------------------------------------");
    console.log("Notarization ID: ", notarization.id);
    console.log("Notarization Method: ", notarization.method);
    console.log(
        `State data as string: "${notarization.state.data.toString()}" or as bytes: [${notarization.state.data.toBytes()}]`,
    );
    console.log("State metadata: ", notarization.state.metadata);
    console.log("Immutable description: ", notarization.immutableMetadata.description);
    console.log("Immutable locking metadata: ", notarization.immutableMetadata.locking);
    console.log("Updatable metadata: ", notarization.updatableMetadata);
    console.log("State version count: ", notarization.stateVersionCount);

    // This is what the complete OnChainNotarization looks like
    console.log("\n----------------------------------------------------");
    console.log("----- All Notarization Properties      -------------");
    console.log("----------------------------------------------------");
    console.log("Notarization: ", notarization);

    // Verify the notarization method is Locked
    assert(notarization.method === "Locked");

    // Check if it has locking metadata and `updateLock` + `transferLock` are set to `UntilDestroyed`
    assert(notarization.immutableMetadata.locking !== undefined);
    assert(notarization.immutableMetadata.locking.updateLock.type === "UntilDestroyed");
    assert(notarization.immutableMetadata.locking.transferLock.type === "UntilDestroyed");

    console.log("\n🔒 The notarization is Locked and cannot be updated or transferred until it is destroyed");
    console.log("🗑️ The notarization can only be destroyed after the delete lock expires");
}

async function main(example?: string) {
    await createLocked();
}

main()
    .catch((error) => {
        console.error("Error creating locked notarization:", error);
    });