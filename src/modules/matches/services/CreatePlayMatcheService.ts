import AppError from '@shared/errors/AppError';
import { inject, injectable } from 'tsyringe';
import { IPlayMatche } from '../domain/models/IPlayMatche';
import { ICreateMatche } from '../domain/models/ICreateMatche';
import { IMatcheRepository } from '../domain/repositories/IMatchesRepository';
import { IPlayerRepository } from '@modules/players/domain/repositories/IPlayersRepository';
import { ISettingRepository } from '@modules/settings/domain/repositories/ISettingsRepository';
import { IGameParamRepository } from '@modules/gameparams/domain/repositories/IGameParamsRepository';

const createDistribution = (weights: any[], size: number) => {
  const distribution = [];
  const sum = weights.reduce((a: any, b: any) => a + b);
  const quant = size / sum;
  for (let i = 0; i < weights.length; ++i) {
      const limit = quant * weights[i];
      for (let j = 0; j < limit; ++j) {
          distribution.push(i);
      }
  }
  return distribution;
};

const randomIndex = (distribution: string | any[]) => {
  const index = Math.floor(distribution.length * Math.random());  // random index
  return distribution[index];
};

const randomItem = (array: string[], distribution: number[]) => {
  const index = randomIndex(distribution);
  return array[index];
};

@injectable()
class CreatePlayMatcheService {

  constructor(

    @inject('MatchesRepository')
    private matchesRepository: IMatcheRepository,

    @inject('PlayersRepository')
    private playersRepository: IPlayerRepository,

    @inject('SettingsRepository')
    private settingsRepository: ISettingRepository,

    @inject('GameParamsRepository')
    private gameparamsRepository: IGameParamRepository

  ) {}

  public async execute({
    player_id,
    bet,
  }: ICreateMatche): Promise<IPlayMatche> {

    //GET DEFAULT INVESTMENT AMOUNT PER MATCH
    const settings = await this.settingsRepository.findByKey('DEFAULT_INVESTMENT');
    const defaultInvestment = settings ? Number(settings.value) : 0;

    //GET GAME PARAMETERS
    const gameparams = await this.gameparamsRepository.find();

    //VERIFY IF THE PLAYER HAS BALANCE TO PLAY THE MATCH
    const player = await this.playersRepository.findById(player_id);

    if (!player) {
      throw new AppError('Player not found.');
    }

    if (bet < defaultInvestment) {
      throw new AppError(`Minimum amount to bet is $${defaultInvestment}`);
    }

    const balance = player ? Number(player?.balance) : 0;

    if (!(Number(bet) <= balance)) {
      throw new AppError(`Player without enough balance. $${balance}`);
    }


    //PLAY-RUN SCRIPT RANDOMLY WITH PROBABILITY
    const gameParamsSymbol = gameparams.map(function(item, indice){
      return item.symbol
    });

    const gameParamsWeight = gameparams.map(function(item, indice){
      return Number(item.weight)
    });

    const distribution = createDistribution(gameParamsWeight, 3);

    var resulfinal: string[] = [];

    for (let i = 0; i < 3; ++i) {
      resulfinal.push(randomItem(gameParamsSymbol, distribution))
    }

    const isMatche = resulfinal.filter((e, i, a) => a.indexOf(e) !== i)
    var  match = Number(isMatche.length) === 2 ? true : false

    const payTableValue = Number(match ? gameparams.find(value => value.symbol === resulfinal[0])?.value : 0);
    const newBalance =  (balance - bet) + (payTableValue);

    // UPDATE BALANCE PLAYER
    if(player){
      player.balance = newBalance;
      await this.playersRepository.save(player);
    }

    //CREATE MATCHE
    const matche = await this.matchesRepository.create({
      player_id,
      bet,
      win: payTableValue,
    });

    return {
      player: {
        balance: newBalance,
      },
      slotmachine_result: {
        columnOne: resulfinal[0],
        columnTwo: resulfinal[1],
        columnThree: resulfinal[2]
      },
      isMatche: match,
      won: payTableValue
    };
  }
}

export default CreatePlayMatcheService;
