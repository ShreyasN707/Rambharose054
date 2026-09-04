import torch
import torch.nn as nn

from preprocessing import FEATURES
from preprocessing import device


class GRUClassifier(nn.Module):

    def __init__(
        self,
        n_features=len(FEATURES),
        hidden=96,
        n_classes=5
    ):
        super().__init__()

        self.gru = nn.GRU(
            n_features,
            hidden,
            num_layers=2,
            batch_first=True,
            dropout=0.15
        )

        self.classifier = nn.Sequential(
            nn.LayerNorm(hidden),

            nn.Linear(
                hidden,
                64
            ),

            nn.GELU(),

            nn.Dropout(0.15),

            nn.Linear(
                64,
                n_classes
            )
        )


    def forward(self, x):

        _, hidden = self.gru(x)

        return self.classifier(
            hidden[-1]
        )


def train(
    model,
    X,
    y,
    epochs=25,
    batch_size=128,
    learning_rate=1e-3
):

    dev = device()

    model.to(dev)
    model.train()

    X = torch.tensor(
        X,
        dtype=torch.float32
    )

    y = torch.tensor(
        y,
        dtype=torch.long
    )

    class_counts = torch.bincount(
        y,
        minlength=int(y.max()) + 1
    ).float()

    class_weights = (
        len(y)
        /
        (
            len(class_counts)
            *
            class_counts.clamp_min(1)
        )
    ).to(dev)

    loss_function = nn.CrossEntropyLoss(
        weight=class_weights
    )

    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=learning_rate,
        weight_decay=1e-4
    )

    for epoch in range(epochs):

        permutation = torch.randperm(
            len(X)
        )

        total_loss = 0.0

        for indices in permutation.split(
            batch_size
        ):

            batch_x = X[indices].to(dev)
            batch_y = y[indices].to(dev)

            prediction = model(batch_x)

            loss = loss_function(
                prediction,
                batch_y
            )

            optimizer.zero_grad()

            loss.backward()

            nn.utils.clip_grad_norm_(
                model.parameters(),
                1.0
            )

            optimizer.step()

            total_loss += (
                loss.item() * len(indices)
            )

        average_loss = (
            total_loss / len(X)
        )

        print(
            f"Classifier epoch "
            f"{epoch + 1:02d}: "
            f"{average_loss:.5f}"
        )

    return model


@torch.no_grad()
def predict(model, X):

    model.eval()

    X = torch.tensor(
        X,
        dtype=torch.float32,
        device=device()
    )

    if X.ndim == 2:
        X = X.unsqueeze(0)

    probabilities = torch.softmax(
        model(X),
        dim=1
    )

    confidence, class_id = probabilities.max(
        dim=1
    )

    return (
        int(class_id[0]),
        float(confidence[0])
    )
