#!/bin/bash

DIR=$(dirname $(readlink -f $0))

echo "//registry.npmjs.org/:_authToken=$NPM_TOKEN" > $HOME/.npmrc

bash $DIR/package-version.sh fluoride packages/fluoride
FLUORIDE_VERSION=$?

if [ "0" -eq "$FLUORIDE_VERSION" ]
then
  cd packages/fluoride
  npm publish --access public
  EXCODE=$?
  cd ../..

  if [ "$EXCODE" != "0" ]
  then
    echo "Unable to publish fluoride"
    exit $EXCODE
  fi
else
  echo "Package fluoride is already published."
fi
