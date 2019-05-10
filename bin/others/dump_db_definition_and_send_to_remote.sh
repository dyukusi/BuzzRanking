mysqldump -u root -p trend_ranking -d > trend_ranking.dump
mysqldump -u root -p trend_ranking a8_program twitter_alternative_search_word  > trend_ranking_table_data.dump
scp ./trend_ranking.dump buzzranking.net:~
scp ./trend_ranking_table_data.dump buzzranking.net:~

